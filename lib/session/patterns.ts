import { ERROR_PATTERNS } from "@/lib/content/error-patterns";

/**
 * Turning recorded errors into something worth showing a learner (PRD F6).
 *
 * The payoff of the whole error-detection feature is this sentence: *you keep
 * saying "I have 20 years"; in English it is "I am 20"*. That is a lesson. What
 * it must never become is a list of everything the learner has ever got wrong,
 * which is a report card, and this product does not issue those.
 *
 * Three rules keep it a lesson:
 *
 *   1. **Two is a pattern; one is a bad morning.** A single slip is not
 *      evidence of anything and telling someone it is would be both wrong and
 *      discouraging.
 *   2. **At most three at a time.** Someone shown eight things to fix fixes
 *      none of them.
 *   3. **Nothing is ever framed as a failure.** The copy names the rule, not
 *      the mistake, and there is no count of errors anywhere on screen.
 *
 * Pure, so the shaping can be tested without a database.
 */

export type ErrorEvent = {
  errorType: string;
  userText: string;
  correctedText: string | null;
};

export type PatternSummary = {
  key: string;
  /** The rule, in Spanish, from the pattern config. */
  explanationEs: string;
  /** The learner's own words, which is what makes it land. */
  example: string;
  correction: string;
  times: number;
};

/** Two occurrences before it counts. One is not a pattern. */
export const PATTERN_THRESHOLD = 2;

/** Three at most. Someone shown eight things to fix fixes none of them. */
export const MAX_PATTERNS = 3;

/**
 * The patterns worth showing, most frequent first.
 *
 * Events are expected newest-first; the example shown is the learner's most
 * recent attempt, because an old one they have already moved past would be
 * unfair as well as unhelpful.
 */
export function summarisePatterns(events: readonly ErrorEvent[]): PatternSummary[] {
  const byKey = new Map<string, { times: number; example: ErrorEvent }>();

  for (const event of events) {
    const seen = byKey.get(event.errorType);
    if (seen) {
      seen.times += 1;
      continue;
    }
    byKey.set(event.errorType, { times: 1, example: event });
  }

  return [...byKey.entries()]
    .flatMap(([key, { times, example }]) => {
      const pattern = ERROR_PATTERNS.find((p) => p.key === key);
      // A key with no matching pattern is a retired rule whose rows outlived
      // it. Skipped rather than shown raw -- the database keeps the history,
      // the learner does not need to see a rule nobody maintains.
      if (!pattern || times < PATTERN_THRESHOLD) return [];
      return [
        {
          key,
          explanationEs: pattern.labelEs,
          example: example.userText,
          correction: example.correctedText ?? "",
          times,
        },
      ];
    })
    .sort((a, b) => b.times - a.times || a.key.localeCompare(b.key))
    .slice(0, MAX_PATTERNS);
}
