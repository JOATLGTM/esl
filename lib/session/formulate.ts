/**
 * The formulation step at the front of Stage 5, Speak (`docs/ROADMAP.md` #1).
 *
 * Everything else in the loop trains around the thing fluency is made of.
 * Retrieve is typed, which bypasses articulation; the scripted half of Speak
 * puts the exact English on screen, which bypasses *formulation* -- the
 * message-to-form step where a learner turns "quiero un café" into words in
 * his mouth. That step is where the four-second gap lives, and nothing in the
 * product asked for it.
 *
 * This does: a Spanish prompt, a visible countdown, and the learner says the
 * English from memory before it is shown. Then the model clip plays and he
 * compares. That is the classic zero-cost fluency drill (4/3/2 and its
 * relatives) -- the evidence is for gains in speech rate and pausing, from
 * small studies, so nothing here promises more than practice.
 *
 * Two rules, both load-bearing:
 *
 *   - **The clock is pressure, never a grade.** It runs out and the answer
 *     appears; nothing is recorded, nothing is scored, nothing is written to
 *     the database. Speaking here is self-reported, exactly like the rest of
 *     the stage, and `tests/spoken-production.test.ts` guarantees a self-report
 *     can never mature a card.
 *   - **Only phrases he has met.** A prompt for a chunk with no `user_cards`
 *     row is a quiz on material never shown, which is the thing the stage
 *     order exists to prevent.
 *
 * Pure, so the picking is testable without a database.
 */

export type FormulationPrompt = {
  chunkId: string;
  /** The Spanish, which is what he sees. */
  es: string;
  /** The English, revealed after the clock. */
  en: string;
  /** The model clip for the comparison; null if the pipeline has not run. */
  audioUrl: string | null;
};

/**
 * How long he gets, per round. Long enough to actually retrieve, short enough
 * to be pressure rather than a pause. The archetype's real-world gap is about
 * four seconds; round one sits just above it on purpose, because a clock a
 * nervous beginner can never beat is a clock he stops trying against. The
 * later rounds shrink it, 4/3/2-style: the material is the same, only the
 * time gets tighter.
 */
export const ROUND_SECONDS = [5, 4, 3] as const;
export const FORMULATION_ROUNDS = ROUND_SECONDS.length;
export const FORMULATION_SECONDS = ROUND_SECONDS[0];

/**
 * How many sessions one hand is held before rotating.
 *
 * The warm-up originally dealt a fresh hand every session, seeded on the
 * session id -- which is the one variant of this drill the evidence says does
 * not stick. De Jong & Perfetti (2011) ran 4/3/2 with same-topic and
 * new-topic groups: both got faster during training, and only the
 * same-content repeaters kept the gain at posttest. Repetition of the same
 * material is the active ingredient, so a hand now holds for three sessions
 * and repeats three times inside each one.
 */
export const FORMULATION_HOLD_SESSIONS = 3;

/** The seed for the current hand: stable within a hold, new after it. */
export function formulationSeed(completedSessions: number): string {
  return `hand-${Math.floor(Math.max(0, completedSessions) / FORMULATION_HOLD_SESSIONS)}`;
}

/** How many per session. Enough to warm up, not enough to feel like a test. */
export const FORMULATION_COUNT = 5;

/**
 * Which met chunks to prompt.
 *
 * Seeded on the *hand* (see `formulationSeed`), not the session: the same
 * five phrases come back for three sessions running, because repeating the
 * same material is what the drill's evidence base actually supports. A
 * refresh mid-step deals the same hand for the same reason.
 *
 * Chunks with audio come first so the comparison has something to play, but
 * a chunk without a clip is still a real prompt -- the pipeline may simply not
 * have run since it was authored.
 */
export function pickFormulation(
  pool: readonly FormulationPrompt[],
  seed: string,
  count = FORMULATION_COUNT,
): FormulationPrompt[] {
  // Sorted before picking: the pool arrives from a database query whose order
  // is not guaranteed, and a hand that must repeat across sessions has to be
  // a function of the seed alone.
  const usable = [...pool]
    .filter((p) => p.es.trim() && p.en.trim())
    .sort((a, b) => a.chunkId.localeCompare(b.chunkId));
  if (usable.length === 0 || count <= 0) return [];

  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  // Two pools walked in turn, not one sorted pool walked with wraparound: a
  // seeded offset into a sorted list can land in the silent tail and wrap
  // back to the voiced head, which puts a silent prompt ahead of a voiced one.
  const walk = (group: FormulationPrompt[], out: FormulationPrompt[]) => {
    if (group.length === 0) return;
    const start = (h >>> 0) % group.length;
    for (let i = 0; i < group.length && out.length < count; i++) {
      out.push(group[(start + i) % group.length]);
    }
  };
  const picked: FormulationPrompt[] = [];
  walk(usable.filter((p) => p.audioUrl), picked);
  walk(usable.filter((p) => !p.audioUrl), picked);
  return picked;
}
