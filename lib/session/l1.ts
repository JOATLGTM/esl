/**
 * The Spanish taper (PRD 4.6), as behaviour rather than a column.
 *
 * `users.l1_support_level` has existed since the first migration and, until
 * now, nothing read it: `l1SupportForBlock` wrote it on every unit advance and
 * the app carried on showing every learner exactly the same amount of Spanish.
 * The comment in `progress.ts` even claimed the app read it. This module is
 * what makes that true.
 *
 * Two things about the design, both load-bearing:
 *
 * **The level is the learner's, not the curriculum's.** `l1SupportForBlock`
 * proposes a level when someone moves up a block; it does not impose one. A
 * learner who wants more English at A0 may have it, and a learner who is
 * quietly drowning may step back. Nobody is ever moved *down* in support
 * without being asked.
 *
 * **Less Spanish is never less help.** Every level offers the same audio, the
 * same replays, the same repair phrases. What tapers is the translation, and
 * only the translation — because the goal is a learner who stops needing to
 * translate, not one who is punished for still doing it.
 */

/** 1 is the most Spanish, 5 the least. Matches the `l1_support_level` CHECK. */
export const MIN_L1_LEVEL = 1;
export const MAX_L1_LEVEL = 5;

export type L1Support = {
  level: number;
  /**
   * Meet offers the Spanish gloss behind a tap.
   *
   * Behind a tap at every level that has it -- the reveal is the signal
   * `shouldOfferMoreSupport` reads, and a gloss printed beside every phrase
   * would both destroy that signal and let the learner read Spanish instead of
   * English. Only the last level withdraws the offer.
   */
  offerGloss: boolean;
  /**
   * Comprehension questions are asked in Spanish where the content has both.
   *
   * Falls back to whatever the scene actually authored, so turning this off
   * cannot blank a question: today no unit has `q_en`, and levels 3 and 5 are
   * therefore identical in Absorb until one does.
   */
  spanishQuestions: boolean;
};

/**
 * What a level shows. Clamped rather than validated: a level out of range is a
 * bug somewhere upstream, and the learner should still get a working screen.
 */
export function l1Support(level: number): L1Support {
  const clamped = Math.min(MAX_L1_LEVEL, Math.max(MIN_L1_LEVEL, Math.round(level || MIN_L1_LEVEL)));
  return {
    level: clamped,
    offerGloss: clamped < MAX_L1_LEVEL,
    spanishQuestions: clamped <= 3,
  };
}

/**
 * The levels a learner may pick for themselves.
 *
 * Three, not five. The five exist because the curriculum steps once per block
 * and the column has to hold that; asking a beginner to choose between "level
 * 3" and "level 4" is asking them to model a system they have never seen. The
 * automatic value is still any of 1-5, and `nearestChoice` maps it onto
 * something sayable.
 */
export const L1_CHOICES = [1, 3, 5] as const;
export type L1Choice = (typeof L1_CHOICES)[number];

/** The offered choice closest to a stored level, for rendering the current one. */
export function nearestChoice(level: number): L1Choice {
  const { level: clamped } = l1Support(level);
  return L1_CHOICES.reduce((best, c) =>
    Math.abs(c - clamped) < Math.abs(best - clamped) ? c : best,
  );
}

/**
 * One step back toward more Spanish, for the offer `shouldOfferMoreSupport`
 * makes. A step, not a reset: someone revealing a lot of glosses needs more
 * help, not to be sent back to the beginning.
 */
export function moreSupport(level: number): number {
  return Math.max(MIN_L1_LEVEL, l1Support(level).level - 1);
}
