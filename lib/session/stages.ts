import type { SessionStage } from "@/lib/supabase/types";

/**
 * The five stages of a daily session (PRD 4.2), and which of them a given unit
 * can actually serve today.
 *
 * The stage list is linear and fixed. What is *not* fixed is whether every
 * stage has something to play: ear training needs human recordings that may not
 * exist yet for a contrast, and a unit authored before the speaking pipeline
 * landed has no dialogue. The rule this file encodes is that a stage with
 * nothing behind it is **skipped, never shown empty** -- Phase 1's exit
 * criterion is 30 consecutive days with no dead end, and a stage that plays
 * silence is exactly the dead end that criterion is about.
 *
 * Everything here is pure. The stage machine is the part most likely to be
 * wrong in a way nobody notices for a week, so it is testable without a
 * database, and `tests/session-stages.test.ts` exercises it offline.
 */

export type Stage = SessionStage;

/** Canonical order. The database enum `session_stage` has the same five, in the same sequence. */
export const STAGE_ORDER = ["ear", "meet", "absorb", "retrieve", "speak"] as const satisfies readonly Stage[];

/**
 * What a unit has to offer, counted once by the caller.
 *
 * Counts rather than booleans on purpose: "how many ear-training clips exist"
 * is the number the recording drive is tracked against, and collapsing it to a
 * flag here would mean counting it twice everywhere else.
 */
export type StageInventory = {
  /** Human minimal-pair recordings for the unit's target contrast. Never TTS (PRD 8.1B). */
  earClips: number;
  chunks: number;
  /**
   * Chunks in this unit the learner has no card for yet.
   *
   * The one per-learner number in here, and it has to be: once every chunk in
   * a unit has been met, Meet has nothing left to introduce, and showing it
   * anyway is the empty stage this whole type exists to prevent.
   */
  newChunks: number;
  scenes: number;
  /** Authored speaking tasks for the unit -- `dialogues` rows. */
  speakingTasks: number;
};

/**
 * Retrieve draws on the same chunks Meet introduced, so it rides on `chunks`
 * rather than on a due-card count: on day one nothing is due yet, and gating
 * retrieval on due cards would silently drop the stage from every first session.
 */
const SERVED_BY: Record<Stage, (inv: StageInventory) => boolean> = {
  ear: (inv) => inv.earClips > 0,
  meet: (inv) => inv.newChunks > 0,
  absorb: (inv) => inv.scenes > 0,
  retrieve: (inv) => inv.chunks > 0,
  speak: (inv) => inv.speakingTasks > 0,
};

/** The stages this unit can serve, in order. May be empty -- see `SessionPage`. */
export function availableStages(inv: StageInventory): Stage[] {
  return STAGE_ORDER.filter((stage) => SERVED_BY[stage](inv));
}

/** Where a fresh session starts. Null when the unit can serve nothing at all. */
export function firstStage(available: readonly Stage[]): Stage | null {
  return available[0] ?? null;
}

/**
 * The stage after `current`, or null when `current` is the last one.
 *
 * `current` is allowed to be a stage that is no longer available -- a contrast
 * can lose its recordings between one session and the next -- so the successor
 * is found by canonical position rather than by index into `available`.
 */
export function nextStage(current: Stage, available: readonly Stage[]): Stage | null {
  const at = STAGE_ORDER.indexOf(current);
  return available.find((stage) => STAGE_ORDER.indexOf(stage) > at) ?? null;
}

/**
 * Where a resumed session picks up.
 *
 * `sessions.stage_reached` is the furthest stage the learner got to. If it is
 * still available, that is the answer. If it is not -- it was skipped, or its
 * content went away -- move forward, never back: replaying a stage the learner
 * already finished is the one outcome that makes resuming feel broken.
 *
 * Null means there is nothing left to do, and the caller should close the
 * session rather than open it on an empty screen.
 */
export function resumeAt(stageReached: Stage, available: readonly Stage[]): Stage | null {
  if (available.includes(stageReached)) return stageReached;
  return nextStage(stageReached, available);
}

export function isFinalStage(current: Stage, available: readonly Stage[]): boolean {
  return nextStage(current, available) === null;
}

/* -------------------------------------------------------------------------- */
/* How much of a unit one session takes on                                    */
/* -------------------------------------------------------------------------- */

/**
 * New chunks to introduce in one session, from the learner's daily goal.
 *
 * The numbers are deliberately low. A unit is 25 chunks and the temptation is
 * to front-load them, but Meet is only the introduction -- every chunk it shows
 * comes back in Retrieve on a schedule, and a session that introduces twenty
 * phrases produces a review queue the next day that no beginner finishes. Six
 * new phrases against a 20-minute goal spreads a unit across four or five
 * sessions, which is also roughly the pace the scenes are written for.
 *
 * Anything outside the three supported goals falls back to the middle rather
 * than throwing: `daily_goal_minutes` is CHECK-constrained to (10, 20, 30) in
 * the database, so a fourth value means the constraint changed and the
 * scheduler should keep working while someone decides what it means.
 */
export function newChunkBudget(dailyGoalMinutes: number): number {
  switch (dailyGoalMinutes) {
    case 10:
      return 4;
    case 30:
      return 8;
    default:
      return 6;
  }
}

/**
 * Position in the progress strip, counting only stages that will actually be
 * shown. A learner whose ear training is skipped sees "1 de 4", not "2 de 5"
 * with a gap they cannot explain.
 */
export function stageProgress(
  current: Stage,
  available: readonly Stage[],
): { position: number; total: number } {
  const index = available.indexOf(current);
  return { position: index === -1 ? 0 : index + 1, total: available.length };
}
