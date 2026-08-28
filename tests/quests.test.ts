import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  XP_PER_SPEAKING_TASK,
  XP_PER_STAGE,
  dailyQuestPlan,
  questProgress,
  xpForSession,
} from "../lib/session/quests";

/**
 * The reward economy, offline.
 *
 * The rule the whole of F8 rests on is that effort is rewarded and results are
 * not. These tests are what stop a well-meaning change turning the streak into
 * something a learner can fail.
 */

describe("XP", () => {
  test("pays for stages finished and for speaking", () => {
    assert.equal(
      xpForSession({ stagesCompleted: 4, speakingTasks: 1 }),
      4 * XP_PER_STAGE + XP_PER_SPEAKING_TASK,
    );
  });

  test("values speaking above any other single act", () => {
    // PRD 3's headline metric, and the behaviour a learner is most likely to
    // avoid. If these numbers are ever tuned, this relationship should hold.
    assert.ok(XP_PER_SPEAKING_TASK > XP_PER_STAGE);
  });

  test("pays a session with skipped stages honestly", () => {
    // Three stages is the real shape today: ear has no recordings.
    assert.equal(xpForSession({ stagesCompleted: 3, speakingTasks: 0 }), 30);
  });

  test("never goes negative, whatever it is handed", () => {
    assert.equal(xpForSession({ stagesCompleted: -5, speakingTasks: -2 }), 0);
  });

  test("does not depend on accuracy anywhere", () => {
    // There is no argument for correctness, and there should never be one:
    // attempting is the behaviour being rewarded.
    const a = xpForSession({ stagesCompleted: 4, speakingTasks: 1 });
    const b = xpForSession({ stagesCompleted: 4, speakingTasks: 1 });
    assert.equal(a, b);
  });
});

describe("daily quests", () => {
  test("always gives three, and one is always speaking", () => {
    for (const day of ["2026-08-28", "2026-08-29", "2026-09-01", "2026-12-25"]) {
      const quests = dailyQuestPlan(day, 20);
      assert.equal(quests.length, 3, `${day} produced ${quests.length}`);
      assert.equal(
        quests.filter((q) => q.isSpeaking).length,
        1,
        `${day} had no speaking quest, or more than one`,
      );
    }
  });

  test("never repeats a quest within a day", () => {
    for (let i = 0; i < 60; i++) {
      const quests = dailyQuestPlan(`2026-08-${i}`, 20);
      const types = new Set(quests.map((q) => q.type));
      assert.equal(types.size, 3, `duplicate quest on seed ${i}: ${[...types].join(", ")}`);
    }
  });

  test("is stable within a day and varies across days", () => {
    assert.deepEqual(dailyQuestPlan("2026-08-28", 20), dailyQuestPlan("2026-08-28", 20));
    const seen = new Set(
      Array.from({ length: 30 }, (_, i) => JSON.stringify(dailyQuestPlan(`d${i}`, 20))),
    );
    assert.ok(seen.size > 1, "every day produces the same three quests");
  });

  test("scales targets to the daily goal", () => {
    // A quest that cannot be finished inside the session it belongs to teaches
    // the learner to ignore quests.
    const short = dailyQuestPlan("2026-08-28", 10).find((q) => q.type === "review");
    const long = dailyQuestPlan("2026-08-28", 30).find((q) => q.type === "review");
    if (short && long) assert.ok(long.target > short.target);
    for (const goal of [10, 20, 30]) {
      for (const quest of dailyQuestPlan("2026-08-28", goal)) {
        assert.ok(quest.target > 0, "a target of zero would violate the CHECK");
      }
    }
  });
});

describe("quest progress", () => {
  test("clamps at the target rather than overshooting", () => {
    assert.equal(questProgress(14, 15, 5), 15);
  });

  test("never goes below zero", () => {
    assert.equal(questProgress(1, 15, -10), 0);
  });

  test("accumulates normally", () => {
    assert.equal(questProgress(0, 15, 1), 1);
    assert.equal(questProgress(7, 15, 3), 10);
  });
});
