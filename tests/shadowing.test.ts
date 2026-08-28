import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { SHADOW_STAGES, nextShadowStage, pickShadowSegment } from "../lib/session/shadowing";

/** Real lines from b1_u1 scene 1, including the one-word ones. */
const lines = [
  { en: "Hello.", startMs: 0, endMs: 604 },
  { en: "My name is Ana. What's your name?", startMs: 2505, endMs: 4673 },
  { en: "Nice to meet you, Miguel.", startMs: 5000, endMs: 7000 },
  { en: "I'm fine, thank you.", startMs: 7500, endMs: 9000 },
  { en: "Goodbye.", startMs: 9500, endMs: 10000 },
];

describe("choosing a line to shadow", () => {
  test("never picks a line too short to have rhythm", () => {
    for (let i = 0; i < 40; i++) {
      const seg = pickShadowSegment(lines, `s${i}`);
      assert.ok(seg, "nothing was picked");
      const words = seg!.en.trim().split(/\s+/).length;
      assert.ok(words >= 3, `picked a ${words}-word line: "${seg!.en}"`);
    }
  });

  test("never picks a line too long to hold in memory", () => {
    const long = [{ en: "one two three four five six seven eight nine ten", startMs: 0, endMs: 5000 }];
    assert.equal(pickShadowSegment(long, "seed"), null);
  });

  test("is stable for a scene, so a learner can improve at the same line", () => {
    assert.deepEqual(pickShadowSegment(lines, "same"), pickShadowSegment(lines, "same"));
  });

  test("returns a real index into the original lines", () => {
    const seg = pickShadowSegment(lines, "seed")!;
    assert.equal(lines[seg.index].en, seg.en);
  });

  test("skips segments with no duration rather than shadowing silence", () => {
    const broken = [{ en: "Nice to meet you", startMs: 100, endMs: 100 }];
    assert.equal(pickShadowSegment(broken, "seed"), null);
  });

  test("a scene of only one-word lines yields nothing to shadow", () => {
    assert.equal(pickShadowSegment([{ en: "Hi.", startMs: 0, endMs: 500 }], "seed"), null);
  });
});

describe("the three stages", () => {
  test("run listen, then repeat, then shadow", () => {
    // The order is the technique. Shadowing a line you have not parsed makes
    // noise; stopping at repeat never builds the timing.
    assert.deepEqual([...SHADOW_STAGES], ["listen", "repeat", "shadow"]);
    assert.equal(nextShadowStage("listen"), "repeat");
    assert.equal(nextShadowStage("repeat"), "shadow");
  });

  test("end after shadowing", () => {
    assert.equal(nextShadowStage("shadow"), null);
  });
});
