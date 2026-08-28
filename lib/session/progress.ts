/**
 * When a learner is done with a unit, and where they go next.
 *
 * This is the rule that decides whether the product has an end. Without it
 * `users.current_unit` is written once at onboarding and never again: Meet runs
 * dry, Absorb replays the same scenes forever, and a learner who finishes a
 * unit has no path to the next one. That is the dead end Phase 1's exit
 * criterion is about.
 *
 * Pure, so the rule can be argued with and tested without a curriculum.
 */

export type UnitProgress = {
  /** Chunks in the unit the learner has never met. */
  newChunks: number;
  /** Sessions the learner has finished in this unit. */
  completedSessions: number;
  /** Scenes the unit contains. */
  sceneCount: number;
};

/**
 * A unit is finished when the learner has met every phrase in it **and** heard
 * the whole story.
 *
 * Both halves matter and neither is sufficient:
 *
 *   - chunks alone would move a learner on before the last scene, and the
 *     scenes are one continuous afternoon (PRD 4.3), so the final one is the
 *     end of something rather than a spare exercise;
 *   - scenes alone would move them on with phrases they had never been shown,
 *     because `pickSceneIndex` wraps and a learner could cycle the story
 *     without exhausting Meet.
 *
 * Mastery is deliberately *not* part of this. Requiring every chunk to reach
 * `learned` would stall a learner behind two production passes on twenty-five
 * phrases, and it is unnecessary: the review queue is not unit-scoped, so
 * unmastered chunks keep coming back long after the unit is behind them.
 */
export function isUnitComplete(progress: UnitProgress): boolean {
  const metEverything = progress.newChunks === 0;
  const heardTheWholeStory =
    progress.sceneCount === 0 || progress.completedSessions >= progress.sceneCount;
  return metEverything && heardTheWholeStory;
}

export type CurriculumUnit = { id: string; block: number; order: number };

/**
 * The unit after `currentUnitId` in curriculum order, or null at the end.
 *
 * Null is a real state, not an error: today there is exactly one authored unit,
 * so every learner reaches the end of the curriculum in about six sessions. The
 * caller has to keep them somewhere coherent rather than advancing into
 * nothing.
 */
export function nextUnit(
  curriculum: readonly CurriculumUnit[],
  currentUnitId: string | null,
): CurriculumUnit | null {
  const ordered = [...curriculum].sort((a, b) => a.block - b.block || a.order - b.order);

  // No current unit means a profile written before onboarding set one. Starting
  // them at the beginning is better than leaving them with nowhere to go.
  if (!currentUnitId) return ordered[0] ?? null;

  const at = ordered.findIndex((unit) => unit.id === currentUnitId);
  // A unit id that is not in the curriculum: it was retired, or renamed. Send
  // them to the start rather than stranding them on a unit that no longer runs.
  if (at === -1) return ordered[0] ?? null;

  return ordered[at + 1] ?? null;
}
