/**
 * Marking a typed answer, and turning the result into something FSRS and the
 * card's product state both understand.
 *
 * Pure and heavily tested, because this is where a language app quietly becomes
 * cruel. Every judgement call here is biased toward the learner: an answer that
 * shows they knew the phrase counts, even when it is not byte-identical to the
 * one in the file. A beginner who typed the right English and was told "no"
 * because of a missing apostrophe does not blame the apostrophe.
 */

import { classifyError } from "@/lib/content/error-patterns";

export type TypedOutcome = "correct" | "close" | "wrong";

/**
 * Contractions, expanded so both sides of a comparison agree.
 *
 * Seven of the twenty-five chunks in the only authored unit contain a
 * contraction, and before this every one of them rejected the expanded form:
 * `What is your name?` was marked **wrong** against `What's your name?`,
 * because expanding costs two edits against a typo budget of one. The content
 * itself teaches the expanded form -- scene `s_0003` has Tom saying "What is
 * your name?" -- so the product was marking wrong a sentence it had taught two
 * stages earlier.
 *
 * Only pronoun and wh-word contractions are listed, never a bare `'s` rule:
 * that would turn the possessive in "Ana's book" into "ana is book".
 */
const CONTRACTIONS: [RegExp, string][] = [
  [/\bi'?m\b/g, "i am"],
  [/\b(you|we|they)'?re\b/g, "$1 are"],
  [/\b(he|she|it|that|there|here|what|where|who|how)'?s\b/g, "$1 is"],
  [/\b(i|you|we|they)'?ve\b/g, "$1 have"],
  [/\b(i|you|he|she|we|they)'?ll\b/g, "$1 will"],
  [/\blet'?s\b/g, "let us"],
  [/\bcan'?t\b/g, "can not"],
  [/\bcannot\b/g, "can not"],
  [/\bwon'?t\b/g, "will not"],
  [/\b(do|does|did|is|are|was|were|has|have|had|would|could|should|must)n'?t\b/g, "$1 not"],
];

/**
 * What two answers have to share to count as the same.
 *
 * Case, punctuation, spacing, accents and contraction all go. `I'm fine, thank
 * you.`, `im fine thank you` and `I am fine thank you` are the same act of
 * production, and none of those differences is something this stage teaches.
 */
export function normalise(text: string): string {
  let out = text
    .toLowerCase()
    .normalize("NFD")
    // Strip combining accents, so `cafe` matches `café`. English answers rarely
    // need them and a Spanish keyboard makes them easy to add by accident.
    .replace(/[̀-ͯ]/g, "")
    ;

  // Applied while the apostrophes are still there. The patterns also accept the
  // apostrophe-less spelling, because a learner typing "dont" on a phone means
  // "do not".
  for (const [pattern, replacement] of CONTRACTIONS) {
    out = out.replace(pattern, replacement);
  }

  return out
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Levenshtein distance, iterative with a single row. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * How many characters may differ and still count as a typo rather than a
 * different answer.
 *
 * Scales with length: one slip in "Hi" is most of the word, one slip in
 * "Nice to meet you, Miguel" is a fat thumb on a phone keyboard.
 */
function typoBudget(length: number): number {
  if (length <= 4) return 0;
  return Math.max(1, Math.floor(length / 10));
}

/**
 * Mark a typed production attempt against the phrase it should have been.
 *
 * The typo budget is generous, and there is one thing it must not forgive: a
 * known Spanish-to-English transfer. "Am fine, thank you" is one character from
 * "I'm fine, thank you" and would sail through as a typo -- but dropping the
 * subject pronoun is a *category* error, not a slip of the thumb, and letting
 * it count as a near-miss would let a learner reach `learned` while making the
 * same structural mistake every time. Observed in a browser on 2026-08-28,
 * which is the only way this was ever going to be noticed.
 */
export function gradeTypedAnswer(
  expected: string,
  actual: string,
  accepts: readonly string[] = [],
): TypedOutcome {
  const got = normalise(actual);
  if (got.length === 0) return "wrong";

  // The authored answer first, then anything the author also declared correct.
  // An exact match against an alternative is exactly as correct as the primary:
  // a learner who answered "Thanks" for "Thank you" produced real English and
  // should not be told otherwise.
  const candidates = [expected, ...accepts];
  if (candidates.some((candidate) => normalise(candidate) === got)) return "correct";

  if (classifyError(expected, actual)) return "wrong";

  // The typo budget is measured against whichever candidate the learner came
  // closest to, so an alternative gets the same forgiveness the primary does.
  const best = Math.min(
    ...candidates.map((candidate) => {
      const want = normalise(candidate);
      return editDistance(want, got) - typoBudget(want.length);
    }),
  );
  return best <= 0 ? "close" : "wrong";
}

/* -------------------------------------------------------------------------- */
/* What the outcome means to the scheduler and to the card                    */
/* -------------------------------------------------------------------------- */

/** `ts-fsrs` Rating values, named here so this module needs no import. */
export const RATING = { Again: 1, Hard: 2, Good: 3, Easy: 4 } as const;
export type Rating = (typeof RATING)[keyof typeof RATING];

export function ratingFor(outcome: TypedOutcome): Rating {
  switch (outcome) {
    case "correct":
      return RATING.Good;
    case "close":
      return RATING.Hard;
    default:
      return RATING.Again;
  }
}

/**
 * Whether an attempt counts toward mastery.
 *
 * Only production counts — PRD F2, and the database enforces it: a card cannot
 * reach `learned` without two production passes. Recognition is how a phrase is
 * introduced, not evidence anyone can say it.
 *
 * A near-miss counts. The learner produced the phrase; the missing letter is a
 * spelling slip, and this is a course about speaking.
 */
export function countsAsProduction(mode: string, outcome: TypedOutcome): boolean {
  if (mode !== "produce_typed" && mode !== "produce_spoken") return false;
  return outcome === "correct" || outcome === "close";
}

/**
 * The product's notion of maturity, which is not the scheduler's.
 *
 * `learned` is claimed only with two production passes behind it, matching the
 * `learned_requires_production` CHECK. Returning anything else here would make
 * the database reject the write, which is the point of putting the rule there.
 */
export function cardStateFor(
  producePasses: number,
  fsrsState: number,
): "new" | "learning" | "review" | "learned" {
  // 2 === State.Review in ts-fsrs.
  const settled = fsrsState === 2;
  if (settled && producePasses >= 2) return "learned";
  if (settled) return "review";
  return "learning";
}
