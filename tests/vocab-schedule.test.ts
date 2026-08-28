import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { VocabScheduleSchema } from "../lib/content/types";
import { buildReleaseTimeline, loadVocabSchedule } from "../lib/content/load";

/**
 * The schedule is what makes the 95% rule a design input instead of an
 * adversary discovered at validation time, so the accumulation has to be
 * exactly right: a word legal one unit too early silently widens every scene
 * after it.
 */

const schedule = VocabScheduleSchema.parse({
  version: 1,
  units: [
    { unit: "b1_u1", releases: ["hello", "name", "my"] },
    { unit: "b1_u2", releases: ["one", "two"] },
    { unit: "b1_u3", releases: [] },
  ],
});

describe("buildReleaseTimeline", () => {
  test("a word is legal from its own unit onward", () => {
    const t = buildReleaseTimeline(schedule);
    assert.ok(t.legalBy.get("b1_u1")!.has("hello"));
    assert.ok(t.legalBy.get("b1_u2")!.has("hello"), "and stays legal after");
  });

  test("a word is not legal before it is released", () => {
    const t = buildReleaseTimeline(schedule);
    assert.equal(t.legalBy.get("b1_u1")!.has("one"), false);
    assert.ok(t.legalBy.get("b1_u2")!.has("one"));
  });

  test("a unit that releases nothing still inherits everything before it", () => {
    const t = buildReleaseTimeline(schedule);
    assert.equal(t.legalBy.get("b1_u3")!.size, 5);
  });

  test("records where each word was released", () => {
    const t = buildReleaseTimeline(schedule);
    assert.equal(t.releasedIn.get("one"), "b1_u2");
  });

  test("a word released twice is reported, not silently merged", () => {
    const t = buildReleaseTimeline(
      VocabScheduleSchema.parse({
        version: 1,
        units: [
          { unit: "b1_u1", releases: ["hello"] },
          { unit: "b1_u2", releases: ["hello", "two"] },
        ],
      }),
    );
    assert.deepEqual(t.duplicates, [{ word: "hello", units: ["b1_u1", "b1_u2"] }]);
  });

  test("case and stray whitespace do not create a second word", () => {
    const t = buildReleaseTimeline(
      VocabScheduleSchema.parse({
        version: 1,
        units: [{ unit: "b1_u1", releases: ["Hello", "  hello  "] }],
      }),
    );
    assert.deepEqual(t.duplicates, [{ word: "hello", units: ["b1_u1", "b1_u1"] }]);
    assert.equal(t.legalBy.get("b1_u1")!.size, 1);
  });

  test("the schedule may plan units that have no content file yet", () => {
    const t = buildReleaseTimeline(
      VocabScheduleSchema.parse({
        version: 1,
        units: [{ unit: "b4_u6", releases: ["opinion"] }],
      }),
    );
    assert.ok(t.legalBy.get("b4_u6")!.has("opinion"));
  });
});

describe("the real schedule", () => {
  const real = loadVocabSchedule();

  test("exists and covers block 1", () => {
    assert.ok(real, "content/vocab-schedule.yaml should exist");
    assert.equal(real!.units.length, 6);
  });

  test("releases no word twice", () => {
    assert.deepEqual(buildReleaseTimeline(real!).duplicates, []);
  });

  test("carries no proper nouns -- the readability scorer already credits those", () => {
    const released = new Set(real!.units.flatMap((u) => u.releases));
    for (const name of ["ana", "miguel", "carlos", "mexico"]) {
      assert.equal(released.has(name), false, `${name} should not be in the schedule`);
    }
  });
});
