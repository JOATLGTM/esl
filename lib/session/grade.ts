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

export type TypedOutcome = "correct" | "close" | "wrong";

/**
 * What two answers have to share to count as the same.
 *
 * Case, punctuation and spacing all go. `I'm fine, thank you.` and
 * `im fine thank you` are the same act of production, and the difference is not
 * something this stage is trying to teach.
 */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    // Strip combining accents, so `cafe` matches `café`. English answers rarely
    // need them and a Spanish keyboard makes them easy to add by accident.
    .replace(/[̀-ͯ]/g, "")
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

/** Mark a typed production attempt against the phrase it should have been. */
export function gradeTypedAnswer(expected: string, actual: string): TypedOutcome {
  const want = normalise(expected);
  const got = normalise(actual);

  if (got.length === 0) return "wrong";
  if (want === got) return "correct";
  if (editDistance(want, got) <= typoBudget(want.length)) return "close";
  return "wrong";
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
