/**
 * Comprehension questions: which scene a session gets, and where the correct
 * answer sits.
 *
 * Pure, and deliberately so -- both decisions have to be made identically by
 * the page and by anything that checks the result later, and neither should
 * need a database to be tested.
 */

/**
 * Which scene this session plays.
 *
 * Derived from how many sessions the learner has already finished in the unit
 * rather than stored, because there is no table that records a scene as seen
 * and inventing one would add a second source of truth about progress. Scenes
 * are a continuous afternoon (PRD 4.3), so they are taken in order; wrapping at
 * the end means a learner who keeps practising a finished unit re-hears the
 * story rather than hitting a wall.
 */
export function pickSceneIndex(completedSessions: number, sceneCount: number): number {
  if (sceneCount <= 0) return 0;
  // Guard the modulo against a negative count arriving from a bad query.
  return Math.max(0, completedSessions) % sceneCount;
}

/* -------------------------------------------------------------------------- */
/* Option order                                                               */
/* -------------------------------------------------------------------------- */
/*
 * Authored content drifts toward putting the true answer first -- it is the one
 * the author thinks of, so it is the one they type first -- and b1_u1 shipped
 * with all eighteen answers at option 1. A learner who taps the first option
 * every time then scores full marks without listening, and the comprehension
 * check measures nothing at all.
 *
 * `npm run content:validate` now warns about that, but a validator only catches
 * the unit somebody looks at. Shuffling here means no unit can have the problem
 * regardless of how it was written.
 *
 * Seeded rather than random: the order has to survive a refresh, or a learner
 * who reloads mid-question sees the options jump. Seeding on the session means
 * it is stable within a sitting and different in the next one.
 */

/** FNV-1a. Small, fast, and stable across runs -- which `Math.random` is not. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a tiny deterministic PRNG. Good enough to shuffle three options. */
function prng(state: number): () => number {
  let a = state;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Question = { prompt: string; options: string[]; answer: number };

/**
 * The same question with its options reordered, and `answer` moved to match.
 *
 * Returns the question unchanged when there is nothing to shuffle, so a
 * single-option question (which the validator rejects anyway) cannot end up
 * with an out-of-range answer.
 */
export function shuffleQuestion(seed: string, question: Question): Question {
  const { prompt, options, answer } = question;
  if (options.length < 2) return question;

  const order = options.map((_, i) => i);
  const random = prng(hashSeed(seed));

  // Fisher-Yates, from the end.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const shuffledAnswer = order.indexOf(answer);
  return {
    prompt,
    options: order.map((i) => options[i]),
    // An answer index that was out of range stays out of range rather than
    // silently becoming a valid-but-wrong option; the validator errors on it.
    answer: shuffledAnswer === -1 ? answer : shuffledAnswer,
  };
}
