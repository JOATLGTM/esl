/**
 * XP and the three daily quests (PRD F8).
 *
 * The whole of F8 is built on one rule: **reward the behaviour, not the
 * result.** A learner who attempted a speaking task and stumbled through it did
 * the thing the product exists to make them do, and gets paid in full. Nothing
 * here can go down, nothing here can be lost, and nothing is awarded for being
 * correct — that is what the review scheduler is for.
 *
 * The counterpart rule is that the streak cannot be broken. `days_practiced`
 * only ever rises; the soft consecutive counter may reset, quietly, with no
 * loss animation and no notification. There is deliberately no column for a
 * broken streak because there is no such thing in this product.
 *
 * Pure, so the economy can be reasoned about without a database.
 */

/* -------------------------------------------------------------------------- */
/* XP                                                                         */
/* -------------------------------------------------------------------------- */

/** One stage of the daily session, finished. */
export const XP_PER_STAGE = 10;

/**
 * Speaking out loud, on top of the stage that contained it.
 *
 * Worth more than anything else because speaking minutes are PRD 3's headline
 * metric and the one behaviour a learner is most likely to avoid. If the
 * numbers ever need tuning, this is the one that should stay biggest.
 */
export const XP_PER_SPEAKING_TASK = 15;

export type SessionEffort = {
  /** Stages actually completed, which is not always five -- some are skipped. */
  stagesCompleted: number;
  speakingTasks: number;
};

/** XP for one finished session. Never negative, never dependent on accuracy. */
export function xpForSession(effort: SessionEffort): number {
  const stages = Math.max(0, effort.stagesCompleted);
  const speaking = Math.max(0, effort.speakingTasks);
  return stages * XP_PER_STAGE + speaking * XP_PER_SPEAKING_TASK;
}

/* -------------------------------------------------------------------------- */
/* Daily quests                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Quest types are stable strings, not an enum.
 *
 * `daily_quests.quest_type` is `text` and keyed unique per learner per day, so
 * adding a quest is a line here rather than a migration -- and a retired quest
 * leaves its old rows readable instead of breaking them.
 */
export type QuestType = "speak" | "session" | "review" | "meet" | "listen";

export type Quest = {
  type: QuestType;
  isSpeaking: boolean;
  target: number;
};

/**
 * The non-speaking pool. Two of these are drawn each day.
 *
 * Targets are scaled from the daily goal so a 10-minute learner is not handed a
 * 20-minute quest -- a quest that cannot be finished inside the session it
 * belongs to is a quest that teaches the learner to ignore quests.
 */
function pool(dailyGoalMinutes: number): Quest[] {
  const reviews = dailyGoalMinutes === 10 ? 8 : dailyGoalMinutes === 30 ? 24 : 15;
  const newPhrases = dailyGoalMinutes === 10 ? 4 : dailyGoalMinutes === 30 ? 8 : 6;

  return [
    { type: "session", isSpeaking: false, target: 1 },
    { type: "review", isSpeaking: false, target: reviews },
    { type: "meet", isSpeaking: false, target: newPhrases },
    { type: "listen", isSpeaking: false, target: 1 },
  ];
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
 * The three quests for one day.
 *
 * The speaking quest is always present -- PRD F8 is explicit that one of the
 * three always is, and it is the only one that guarantees the learner opens
 * their mouth. The other two are drawn from the pool, seeded on the date so
 * they are stable all day and different tomorrow.
 */
export function dailyQuestPlan(seed: string, dailyGoalMinutes: number): Quest[] {
  const speaking: Quest = { type: "speak", isSpeaking: true, target: 1 };

  const others = pool(dailyGoalMinutes);
  const base = hashSeed(seed);
  const first = base % others.length;
  // A different stride from the first pick, so the two are never the same quest.
  const second = (first + 1 + (base >>> 8) % (others.length - 1)) % others.length;

  return [speaking, others[first], others[second]];
}

/** Progress after an event, clamped at the target so a quest cannot overshoot. */
export function questProgress(current: number, target: number, by: number): number {
  return Math.min(target, Math.max(0, current + by));
}
