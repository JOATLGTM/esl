/**
 * Stage 1, Ear (PRD 4.2 / F3 / 8.1B): high-variability phonetic training.
 *
 * The mechanism is the variability. A learner who hears "sheep" and "ship" from
 * one talker learns that talker; a learner who hears them from six learns the
 * *category*, and the category generalises to voices they have never met. So
 * the single rule this file exists to enforce is that consecutive items never
 * share a speaker — get that wrong and the drill still looks correct, still
 * feels correct, and teaches substantially less.
 *
 * This is also why the clips are human recordings and never TTS: neural voices
 * are far narrower acoustically than real people, and `content/voices.yaml`
 * refuses an `hvpt` role outright.
 *
 * Pure, so all of it can be checked without a single recording existing — which
 * matters, because none do yet.
 */

export type PairClip = { speakerId: string; word: string; url: string };

export type MinimalPair = {
  id: string;
  wordA: string;
  wordB: string;
  ipaA: string;
  ipaB: string;
  audio: PairClip[];
};

export type DrillItem = {
  pairId: string;
  wordA: string;
  wordB: string;
  ipaA: string;
  ipaB: string;
  /** Which of the two was actually said. */
  target: "a" | "b";
  url: string;
  speakerId: string;
};

/** Items in one drill, from the daily goal. Short: this is warm-up, not the session. */
export function drillBudget(dailyGoalMinutes: number): number {
  switch (dailyGoalMinutes) {
    case 10:
      return 6;
    case 30:
      return 14;
    default:
      return 10;
  }
}

/** FNV-1a, matching the other seeded pickers in this codebase. */
function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Build a drill: `budget` items, never two in a row from the same speaker.
 *
 * Returns fewer items than asked for rather than repeating a speaker
 * back-to-back, and returns nothing at all when the recordings do not exist —
 * which is today's state, and why `availableStages` skips the stage entirely
 * rather than showing a drill with nothing to play.
 */
export function buildDrill(pairs: MinimalPair[], budget: number, seed: string): DrillItem[] {
  const usable = pairs.filter((pair) => pair.audio.length > 0);
  if (usable.length === 0 || budget <= 0) return [];

  const items: DrillItem[] = [];
  let lastSpeaker: string | null = null;
  const base = hashSeed(seed);

  for (let i = 0; items.length < budget && i < budget * 4; i++) {
    const pair = usable[(base + i * 7) % usable.length];
    // Alternate which of the pair is asked, so neither word becomes the
    // default answer over a long run.
    const target: "a" | "b" = (base + i) % 2 === 0 ? "a" : "b";
    const word = target === "a" ? pair.wordA : pair.wordB;

    const candidates = pair.audio.filter(
      (clip) => clip.word === word && clip.speakerId !== lastSpeaker,
    );
    // No clip of this word from a *different* speaker: skip the item rather
    // than repeat a talker. A back-to-back repeat is the one thing that
    // quietly breaks the training.
    if (candidates.length === 0) continue;

    const clip = candidates[(base + i * 13) % candidates.length];
    items.push({
      pairId: pair.id,
      wordA: pair.wordA,
      wordB: pair.wordB,
      ipaA: pair.ipaA,
      ipaB: pair.ipaB,
      target,
      url: clip.url,
      speakerId: clip.speakerId,
    });
    lastSpeaker = clip.speakerId;
  }

  return items;
}

/* -------------------------------------------------------------------------- */
/* Progress on a contrast                                                     */
/* -------------------------------------------------------------------------- */

/** The trailing window the retirement rule reads. */
export const RECENT_WINDOW = 30;

/** PRD F3: retire a contrast to maintenance at >= 90% over 30 trailing items. */
export const RETIRE_ACCURACY = 0.9;

export type ContrastStats = {
  attempts: number;
  correct: number;
  /** Newest last, at most `RECENT_WINDOW` long. */
  recent: boolean[];
  retiredAt: string | null;
};

/**
 * Fold a drill's results into a contrast's record.
 *
 * The rolling window is the whole point: a lifetime ratio hides a learner who
 * has just cracked a contrast they used to fail, and a contrast they cracked
 * months ago should not keep costing them time every day.
 *
 * Retirement is not reversal — a retired contrast comes back on the maintenance
 * schedule rather than disappearing, so `retiredAt` is only ever set here, and
 * only once.
 */
export function foldDrillResults(
  current: ContrastStats,
  results: boolean[],
  now: string,
): ContrastStats {
  const recent = [...current.recent, ...results].slice(-RECENT_WINDOW);
  const attempts = current.attempts + results.length;
  const correct = current.correct + results.filter(Boolean).length;

  const accuracy = recent.length > 0 ? recent.filter(Boolean).length / recent.length : 0;
  const readyToRetire = recent.length >= RECENT_WINDOW && accuracy >= RETIRE_ACCURACY;

  return {
    attempts,
    correct,
    recent,
    retiredAt: current.retiredAt ?? (readyToRetire ? now : null),
  };
}
