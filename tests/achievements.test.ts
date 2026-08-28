import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { earnedAchievements, newlyEarned, type LearnerStats } from "../lib/session/achievements";

const NOTHING: LearnerStats = {
  daysPracticed: 0,
  speakingTasksTotal: 0,
  scenesHeard: 0,
  chunksMet: 0,
  cardsLearned: 0,
  unitsFinished: 0,
};

describe("achievements", () => {
  test("a brand new learner has earned nothing", () => {
    assert.deepEqual(earnedAchievements(NOTHING), []);
  });

  test("one session earns the first three", () => {
    // The moment a beginner is most likely to quit is before they have any
    // evidence this works, so the early thresholds are deliberately low.
    const afterOne = { ...NOTHING, daysPracticed: 1, speakingTasksTotal: 1, scenesHeard: 1 };
    assert.deepEqual(earnedAchievements(afterOne), [
      "first_session",
      "first_words",
      "first_story",
    ]);
  });

  test("nothing is awarded for being correct", () => {
    // There is no accuracy field in LearnerStats, and there should never be
    // one: effort is what this product rewards.
    assert.ok(!Object.keys(NOTHING).some((k) => /accur|correct|score|streak/i.test(k)));
  });

  test("mastery means production, matching the rest of the product", () => {
    assert.ok(earnedAchievements({ ...NOTHING, cardsLearned: 1 }).includes("first_learned"));
  });

  test("only reports what is not already held", () => {
    const stats = { ...NOTHING, daysPracticed: 7, speakingTasksTotal: 1, scenesHeard: 1 };
    const all = earnedAchievements(stats);
    assert.ok(all.includes("seven_days"));
    assert.deepEqual(newlyEarned(stats, all), [], "an award was handed out twice");
    assert.deepEqual(newlyEarned(stats, all.slice(1)), [all[0]]);
  });

  test("is monotonic — nothing can be un-earned", () => {
    // Recomputed in full each time, so a learner who qualified once must still
    // qualify on strictly better stats.
    const early = { ...NOTHING, daysPracticed: 7, scenesHeard: 3 };
    const later = { ...early, daysPracticed: 40, scenesHeard: 60, chunksMet: 200 };
    for (const key of earnedAchievements(early)) {
      assert.ok(earnedAchievements(later).includes(key), `${key} was lost`);
    }
  });

  test("thirty days is a superset of seven", () => {
    const month = earnedAchievements({ ...NOTHING, daysPracticed: 30 });
    assert.ok(month.includes("seven_days") && month.includes("thirty_days"));
  });
});
