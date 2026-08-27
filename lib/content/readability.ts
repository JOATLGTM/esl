import { classifyCognate, loadCognateData, type CognateData } from "./cognates";
import { morphologicalVariants, tokenize, tokenizeTranscript } from "./tokenize";

/**
 * The 95% rule (PRD F4), enforced in code.
 *
 *   readability_score = (known_tokens + cognate_tokens) / total_tokens
 *   Serve an item only if readability_score >= 0.95 for this user.
 *
 * The same function runs at author time (against the cumulative curriculum
 * known-word set) and at request time (against the user's real known_words).
 * One implementation, so a scene that passes validation cannot fail for a user
 * who is exactly on-track.
 */

export const READABILITY_THRESHOLD = 0.95;

/** Cognates are a scaffold, not a permanent credit. They stop counting at A2+. */
const COGNATE_CREDIT_LEVELS = new Set(["A0", "A1", "A1+", "A2"]);

export type TokenVerdict = {
  token: string;
  status: "known" | "cognate" | "proper_noun" | "unknown";
};

export type ReadabilityReport = {
  score: number;
  passes: boolean;
  total: number;
  known: number;
  cognate: number;
  /** Deduplicated, in first-appearance order -- this is what an author fixes. */
  unknown: string[];
  tokens: TokenVerdict[];
};

export type ReadabilityOptions = {
  /** Count transparent cognates as known. Defaults on; off from A2+. */
  countCognates?: boolean;
  cognateData?: CognateData;
};

export function cognateCreditAllowed(cefr: string): boolean {
  return COGNATE_CREDIT_LEVELS.has(cefr);
}

function isKnown(token: string, known: ReadonlySet<string>): boolean {
  if (known.has(token)) return true;
  return morphologicalVariants(token).some((v) => known.has(v));
}

/** Score already-tokenized text. */
export function scoreTokens(
  tokens: string[],
  known: ReadonlySet<string>,
  options: ReadabilityOptions = {}
): ReadabilityReport {
  const countCognates = options.countCognates ?? true;
  const data = options.cognateData ?? loadCognateData();

  const verdicts: TokenVerdict[] = [];
  const unknown: string[] = [];
  const seenUnknown = new Set<string>();
  let knownCount = 0;
  let cognateCount = 0;

  for (const token of tokens) {
    if (isKnown(token, known)) {
      knownCount++;
      verdicts.push({ token, status: "known" });
      continue;
    }

    const verdict = classifyCognate(token, data);
    // Proper nouns are always free -- they cost a Spanish reader nothing and
    // they are not vocabulary, so they don't wait on the cognate credit window.
    if (verdict.cognate && verdict.via === "proper_noun") {
      knownCount++;
      verdicts.push({ token, status: "proper_noun" });
      continue;
    }
    if (verdict.cognate && countCognates) {
      cognateCount++;
      verdicts.push({ token, status: "cognate" });
      continue;
    }

    verdicts.push({ token, status: "unknown" });
    if (!seenUnknown.has(token)) {
      seenUnknown.add(token);
      unknown.push(token);
    }
  }

  const total = tokens.length;
  // An empty item is not "perfectly readable" -- it is broken content.
  const score = total === 0 ? 0 : (knownCount + cognateCount) / total;

  return {
    score,
    passes: total > 0 && score >= READABILITY_THRESHOLD,
    total,
    known: knownCount,
    cognate: cognateCount,
    unknown,
    tokens: verdicts,
  };
}

export function scoreText(
  text: string,
  known: ReadonlySet<string>,
  options?: ReadabilityOptions
): ReadabilityReport {
  return scoreTokens(tokenize(text), known, options);
}

/** Score a speaker-labelled scene transcript. Speaker labels are not content. */
export function scoreTranscript(
  transcript: string,
  known: ReadonlySet<string>,
  options?: ReadabilityOptions
): ReadabilityReport {
  return scoreTokens(tokenizeTranscript(transcript), known, options);
}

/**
 * How many unknown tokens an item of this length can still afford.
 * Surfaced in validator output so an author knows whether to cut one word or
 * rewrite the scene.
 */
export function unknownBudget(totalTokens: number): number {
  return Math.floor(totalTokens * (1 - READABILITY_THRESHOLD));
}
