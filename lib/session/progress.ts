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

/* -------------------------------------------------------------------------- */
/* The Spanish taper (PRD 4.5)                                                */
/* -------------------------------------------------------------------------- */

/**
 * How much Spanish support a block carries: 1 is the most, 5 the least.
 *
 * Derived from the block rather than stored per learner, but *overridable* —
 * `users.l1_support_level` is what the app reads, and this only sets it when
 * the learner moves up. A learner who wants English chrome at A1 is allowed to
 * have it, and a learner who is quietly struggling gets offered a step back.
 *
 * The signal for that offer is `user_cards.gloss_reveals`: someone revealing
 * the Spanish on most cards is not ready for less of it, and reveal taps are
 * the only way to notice, because nobody reports being lost.
 */
export function l1SupportForBlock(block: number): number {
  // Blocks 1-2 share the most supported level; after that it steps once per
  // block, matching `content/curriculum.yaml`.
  return Math.min(5, Math.max(1, block <= 2 ? 1 : block - 1));
}

/**
 * Whether to offer the learner more Spanish.
 *
 * Offered, never imposed: the threshold is high because being wrong here means
 * telling someone who is doing fine that they look like they are struggling.
 * At level 1 there is nothing to offer -- they already have all of it.
 */
export function shouldOfferMoreSupport(
  cardsSeen: number,
  cardsRevealed: number,
  currentLevel: number,
): boolean {
  if (currentLevel <= 1) return false;
  // Too few cards to read anything into.
  if (cardsSeen < 10) return false;
  return cardsRevealed / cardsSeen >= 0.6;
}
