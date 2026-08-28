import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { daysBetween, localDate, practiceCounters } from "../lib/session/day";
import {
  STAGE_ORDER,
  availableStages,
  firstStage,
  isFinalStage,
  newChunkBudget,
  nextStage,
  resumeAt,
  stageProgress,
} from "../lib/session/stages";
import type { StageInventory } from "../lib/session/stages";

/**
 * The session state machine, offline.
 *
 * These run without a database on purpose. The stage machine decides what a
 * learner sees next and where a resumed session picks up; both are the kind of
 * thing that can be wrong for a week before anyone notices, and neither needs
 * a network to check.
 */

/** A fully authored unit with its ear-training recordings done, first visit. */
const complete: StageInventory = {
  earClips: 300,
  chunks: 25,
  newChunks: 25,
  scenes: 6,
  speakingTasks: 1,
};

/** Where b1_u1 actually stands today: no human recordings, no seeded dialogue. */
const asAuthoredToday: StageInventory = {
  earClips: 0,
  chunks: 25,
  newChunks: 25,
  scenes: 6,
  speakingTasks: 0,
};

describe("stage availability", () => {
  test("a fully authored unit serves all five stages in order", () => {
    assert.deepEqual(availableStages(complete), [...STAGE_ORDER]);
  });

  test("ear training is skipped when no human recordings exist", () => {
    // The stage that has no audio is dropped, not shown empty -- Phase 1's
    // exit criterion is 30 days with no dead end.
    assert.deepEqual(availableStages(asAuthoredToday), ["meet", "absorb", "retrieve"]);
  });

  test("retrieve rides on chunks, not on due cards, so it survives a first session", () => {
    assert.ok(availableStages({ ...complete, earClips: 0 }).includes("retrieve"));
  });

  test("meet drops out once every chunk in the unit has been met", () => {
    // The learner keeps the unit's scenes and its review queue; there is simply
    // nothing left to introduce, and an empty Meet is the dead end this avoids.
    const allMet = availableStages({ ...complete, newChunks: 0 });
    assert.ok(!allMet.includes("meet"));
    assert.deepEqual(allMet, ["ear", "absorb", "retrieve", "speak"]);
  });

  test("retrieve survives even when nothing is new, because the cards remain", () => {
    assert.ok(availableStages({ ...complete, newChunks: 0 }).includes("retrieve"));
  });

  test("no chunks takes out both meet and retrieve", () => {
    assert.deepEqual(availableStages({ ...complete, chunks: 0, newChunks: 0 }), [
      "ear",
      "absorb",
      "speak",
    ]);
  });

  test("a unit that can serve nothing yields no stages at all", () => {
    const empty = { earClips: 0, chunks: 0, newChunks: 0, scenes: 0, speakingTasks: 0 };
    assert.deepEqual(availableStages(empty), []);
    assert.equal(firstStage(availableStages(empty)), null);
  });
});

describe("moving forward", () => {
  const today = availableStages(asAuthoredToday);

  test("advances through the available stages only", () => {
    assert.equal(nextStage("meet", today), "absorb");
    assert.equal(nextStage("absorb", today), "retrieve");
  });

  test("skips over stages that are not available", () => {
    const noAbsorb = availableStages({ ...complete, scenes: 0 });
    assert.equal(nextStage("meet", noAbsorb), "retrieve");
  });

  test("the last available stage has no successor", () => {
    assert.equal(nextStage("retrieve", today), null);
    assert.ok(isFinalStage("retrieve", today));
    assert.ok(!isFinalStage("meet", today));
  });

  test("a stage that is no longer available still has a successor", () => {
    // A contrast can lose its recordings between one session and the next.
    assert.equal(nextStage("ear", today), "meet");
  });
});

describe("resuming", () => {
  const today = availableStages(asAuthoredToday);

  test("picks up exactly where the learner stopped", () => {
    assert.equal(resumeAt("absorb", today), "absorb");
  });

  test("never sends the learner back through a stage they finished", () => {
    // `stage_reached` is 'ear' on any row created before availability was
    // known; resuming moves forward to the first stage that exists.
    assert.equal(resumeAt("ear", today), "meet");
  });

  test("returns null when nothing is left, rather than looping", () => {
    assert.equal(resumeAt("speak", today), null);
  });
});

describe("progress", () => {
  test("counts only the stages the learner will actually see", () => {
    const today = availableStages(asAuthoredToday);
    assert.deepEqual(stageProgress("meet", today), { position: 1, total: 3 });
    assert.deepEqual(stageProgress("retrieve", today), { position: 3, total: 3 });
  });

  test("a stage outside the available set reports no position", () => {
    assert.deepEqual(stageProgress("speak", availableStages(asAuthoredToday)), {
      position: 0,
      total: 3,
    });
  });
});

describe("new chunks per session", () => {
  test("scales with the daily goal", () => {
    assert.equal(newChunkBudget(10), 4);
    assert.equal(newChunkBudget(20), 6);
    assert.equal(newChunkBudget(30), 8);
  });

  test("a 20-minute goal spreads a 25-chunk unit over several sessions", () => {
    // If this ever divides into one or two sessions, Meet has become a
    // firehose and the next day's review queue is unfinishable.
    assert.ok(Math.ceil(25 / newChunkBudget(20)) >= 4);
  });

  test("an unsupported goal falls back to the middle rather than throwing", () => {
    // `daily_goal_minutes` is CHECK-constrained to (10, 20, 30); a fourth value
    // means the constraint moved, and the session should still work.
    assert.equal(newChunkBudget(45), 6);
    assert.equal(newChunkBudget(0), 6);
  });
});

describe("the learner's day", () => {
  // 04:30 UTC is still the previous evening across the Americas.
  const lateEvening = new Date("2026-08-27T04:30:00Z");

  test("is measured in the learner's timezone, not the server's", () => {
    assert.equal(localDate("UTC", lateEvening), "2026-08-27");
    assert.equal(localDate("America/Mexico_City", lateEvening), "2026-08-26");
    assert.equal(localDate("America/Bogota", lateEvening), "2026-08-26");
  });

  test("falls back to UTC on a timezone Postgres accepted but Intl does not", () => {
    assert.equal(localDate("Mars/Olympus_Mons", lateEvening), "2026-08-27");
  });

  test("counts whole days between two dates", () => {
    assert.equal(daysBetween("2026-08-26", "2026-08-27"), 1);
    assert.equal(daysBetween("2026-08-27", "2026-08-27"), 0);
    assert.equal(daysBetween("2026-08-20", "2026-08-27"), 7);
    // Across a DST change in the learner's zone, both sides are still plain
    // wall-clock dates, so the arithmetic does not drift.
    assert.equal(daysBetween("2026-10-31", "2026-11-01"), 1);
  });
});

describe("practice counters", () => {
  const base = { daysPracticed: 4, consecutiveDays: 2, lastPracticedOn: "2026-08-26" };

  test("a second session on the same day changes nothing", () => {
    assert.equal(practiceCounters({ ...base, lastPracticedOn: "2026-08-27" }, "2026-08-27"), null);
  });

  test("practising the next day extends the run", () => {
    assert.deepEqual(practiceCounters(base, "2026-08-27"), {
      daysPracticed: 5,
      consecutiveDays: 3,
      lastPracticedOn: "2026-08-27",
    });
  });

  test("a gap resets the soft run but never the total", () => {
    // PRD F8: days_practiced only ever goes up. There is no broken streak.
    assert.deepEqual(practiceCounters(base, "2026-09-02"), {
      daysPracticed: 5,
      consecutiveDays: 1,
      lastPracticedOn: "2026-09-02",
    });
  });

  test("the first session ever starts a run of one", () => {
    const fresh = { daysPracticed: 0, consecutiveDays: 0, lastPracticedOn: null };
    assert.deepEqual(practiceCounters(fresh, "2026-08-27"), {
      daysPracticed: 1,
      consecutiveDays: 1,
      lastPracticedOn: "2026-08-27",
    });
  });
});
