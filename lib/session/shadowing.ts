/**
 * Shadowing (PRD F11): hear a line, say it in the gap, then say it *over* the
 * speaker.
 *
 * The three stages are the technique, not decoration — `shadowing_stage` is an
 * enum of exactly `listen | repeat | shadow` because skipping straight to
 * shadowing a line you have not yet parsed produces noise, and stopping at
 * repeat never builds the timing that makes speech sound fluent.
 *
 * It lives inside Absorb rather than as a sixth stage: shadowing works on
 * material you have just understood, and the learner has spent the last two
 * minutes doing exactly that. It also means no migration — the five stages of
 * `session_stage` are the PRD's, and adding to them would be a schema change to
 * accommodate a UI decision.
 *
 * Pure, so segment choice can be checked without audio.
 */

export const SHADOW_STAGES = ["listen", "repeat", "shadow"] as const;
export type ShadowStage = (typeof SHADOW_STAGES)[number];

export type ShadowSegment = { index: number; en: string; startMs: number; endMs: number };

type TimedLine = { en: string; startMs: number; endMs: number };

/**
 * Which line of the scene to shadow.
 *
 * Not the first, and not the longest. A one-word line ("Hello.") teaches
 * nothing about timing, and a ten-word line at A0 is a wall — the useful
 * material is a line long enough to have rhythm and short enough to hold in
 * memory. Seeded so a learner who replays the scene gets the same line and can
 * actually improve at it, rather than a new one each time.
 */
export function pickShadowSegment(lines: TimedLine[], seed: string): ShadowSegment | null {
  const usable = lines
    .map((line, index) => ({ ...line, index, words: line.en.trim().split(/\s+/).length }))
    // Three to eight words: long enough to have a shape, short enough to hold.
    .filter((line) => line.words >= 3 && line.words <= 8 && line.endMs > line.startMs);

  if (usable.length === 0) return null;

  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  const pick = usable[(h >>> 0) % usable.length];
  return { index: pick.index, en: pick.en, startMs: pick.startMs, endMs: pick.endMs };
}

/** The stage after this one, or null when the learner has finished shadowing. */
export function nextShadowStage(stage: ShadowStage): ShadowStage | null {
  const at = SHADOW_STAGES.indexOf(stage);
  return SHADOW_STAGES[at + 1] ?? null;
}
