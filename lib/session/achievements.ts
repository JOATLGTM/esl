/**
 * Achievements (PRD F8).
 *
 * Every one of these is awarded for something the learner *did*, never for
 * being correct, and never for a streak they have to protect. There is
 * deliberately no achievement for accuracy, none for speed, and none that can
 * be lost once earned — `achievements` has no delete path and the keys are
 * append-only.
 *
 * Keys are stable strings and must never be reused for a different meaning: a
 * learner who earned `first_words` in week one keeps that row forever, and
 * redefining the key would silently rewrite their history.
 *
 * Pure, so the whole set can be checked without a database.
 */

export type AchievementKey =
  | "first_session"
  | "first_words"
  | "first_story"
  | "seven_days"
  | "thirty_days"
  | "fifty_phrases"
  | "first_learned"
  | "unit_finished";

/** Everything the rules below are allowed to look at. */
export type LearnerStats = {
  daysPracticed: number;
  speakingTasksTotal: number;
  scenesHeard: number;
  chunksMet: number;
  cardsLearned: number;
  unitsFinished: number;
};

/**
 * The rules, in the order they read on screen.
 *
 * Thresholds are low on purpose. The first three are reachable in a single
 * session, because the moment a beginner is most likely to quit is before they
 * have any evidence that this works.
 */
const RULES: { key: AchievementKey; earned: (s: LearnerStats) => boolean }[] = [
  { key: "first_session", earned: (s) => s.daysPracticed >= 1 },
  // Speaking out loud once. The single most important thing that can happen.
  { key: "first_words", earned: (s) => s.speakingTasksTotal >= 1 },
  { key: "first_story", earned: (s) => s.scenesHeard >= 1 },
  { key: "fifty_phrases", earned: (s) => s.chunksMet >= 50 },
  { key: "seven_days", earned: (s) => s.daysPracticed >= 7 },
  // Mastery, which in this product means two production passes -- not recall.
  { key: "first_learned", earned: (s) => s.cardsLearned >= 1 },
  { key: "unit_finished", earned: (s) => s.unitsFinished >= 1 },
  { key: "thirty_days", earned: (s) => s.daysPracticed >= 30 },
];

/**
 * Which achievements the learner qualifies for.
 *
 * Note this is a *total* recomputation rather than an event stream: it is
 * cheap, it is idempotent, and it means a learner who qualified while a bug was
 * swallowing the event still gets the row the next time they finish a session.
 */
export function earnedAchievements(stats: LearnerStats): AchievementKey[] {
  return RULES.filter((rule) => rule.earned(stats)).map((rule) => rule.key);
}

/** Keys the learner qualifies for and does not already hold. */
export function newlyEarned(
  stats: LearnerStats,
  alreadyHeld: readonly string[],
): AchievementKey[] {
  const held = new Set(alreadyHeld);
  return earnedAchievements(stats).filter((key) => !held.has(key));
}
