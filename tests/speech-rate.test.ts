import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  MAX_SCENE_SPREAD,
  MAX_WPM,
  MIN_WORDS,
  MIN_WPM,
  measureSceneSpreads,
  measureVoiceRates,
  rateProblems,
  type RateClip,
} from "../lib/content/speech-rate";

/** A clip of `words` words spoken at `wpm`. */
function clip(voiceId: string, wpm: number, words = 6, ownerId = "s_0001"): RateClip {
  return {
    voiceId,
    text: Array(words).fill("word").join(" "),
    durationMs: (words / wpm) * 60_000,
    kind: "scene_line",
    ownerId,
  };
}

describe("measuring", () => {
  test("recovers the rate a clip was built at", () => {
    const [rate] = measureVoiceRates([clip("a", 150), clip("a", 150), clip("a", 150)]);
    assert.equal(Math.round(rate.wpm), 150);
    assert.equal(rate.samples, 3);
  });

  test("ignores clips too short to measure", () => {
    // Encoders pad the head and tail with silence — a rounding error across a
    // sentence, most of the duration of "Hi". Measuring those would report
    // every voice as absurdly slow and the check would be ignored in a week.
    const short: RateClip = {
      voiceId: "a",
      text: "Hi",
      durationMs: 900,
      kind: "chunk",
      ownerId: "c_0001",
    };
    assert.deepEqual(measureVoiceRates([short]), []);
    assert.ok(MIN_WORDS >= 3);
  });

  test("reports voices slowest first", () => {
    const rates = measureVoiceRates([clip("fast", 170), clip("slow", 95), clip("mid", 140)]);
    assert.deepEqual(rates.map((r) => r.voiceId), ["slow", "mid", "fast"]);
  });
});

describe("the gate", () => {
  const declared = new Map([["a", 155]]);

  test("passes audio that does what the roster says", () => {
    const clips = [clip("a", 150), clip("a", 152), clip("a", 148)];
    assert.deepEqual(rateProblems(clips, declared), []);
  });

  test("catches an engine ignoring the declared rate", () => {
    // The actual bug: every voice declared 150-160, macOS `say` produced 90-136,
    // and the pipeline reported success.
    const clips = [clip("a", 95), clip("a", 98), clip("a", 92)];
    const problems = rateProblems(clips, declared);
    assert.ok(problems.some((p) => /declares 155 wpm but speaks at/.test(p.message)));
  });

  test("catches a voice outside the band even when nothing was declared", () => {
    const slow = rateProblems([clip("a", 80), clip("a", 82), clip("a", 78)], new Map());
    assert.ok(slow.some((p) => p.message.includes("wpm")));
    const fast = rateProblems([clip("a", 240), clip("a", 235), clip("a", 245)], new Map());
    assert.ok(fast.some((p) => p.message.includes("wpm")));
    assert.ok(MIN_WPM < MAX_WPM);
  });

  test("catches two characters at different speeds in one conversation", () => {
    // Ana at 132 answering Miguel at 98 — the learner has no way to know the
    // difference is an artefact rather than something about the character.
    const clips = [
      clip("ana", 132), clip("ana", 130), clip("ana", 134),
      clip("miguel", 98), clip("miguel", 96), clip("miguel", 100),
    ];
    const problems = rateProblems(clips, new Map());
    assert.ok(problems.some((p) => p.where === "scene:s_0001" && /faster than/.test(p.message)));
  });

  test("tolerates the variation real people have", () => {
    const clips = [
      clip("ana", 150), clip("ana", 152), clip("ana", 148),
      clip("miguel", 140), clip("miguel", 138), clip("miguel", 142),
    ];
    assert.deepEqual(rateProblems(clips, new Map()), []);
    assert.ok(MAX_SCENE_SPREAD > 1);
  });

  test("compares speakers within a scene, not across the course", () => {
    // Two units may reasonably differ; two characters answering each other
    // may not.
    const clips = [
      clip("a", 150, 6, "s_0001"), clip("a", 150, 6, "s_0001"), clip("a", 150, 6, "s_0001"),
      clip("b", 120, 6, "s_0002"), clip("b", 120, 6, "s_0002"), clip("b", 120, 6, "s_0002"),
    ];
    assert.deepEqual(measureSceneSpreads(clips), []);
    assert.deepEqual(rateProblems(clips, new Map()), []);
  });

  test("says nothing when there is no audio yet", () => {
    assert.deepEqual(rateProblems([], new Map()), []);
  });

  test("does not accuse a voice on one or two samples", () => {
    assert.deepEqual(rateProblems([clip("a", 60), clip("a", 60)], declared), []);
  });
});
