import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  MAX_SCENE_SPREAD,
  MIN_SCENE_SAMPLES,
  MAX_WPM,
  MIN_WORDS,
  MIN_WPM,
  SYLLABLES_PER_WORD,
  estimateSyllables,
  measureSceneSpreads,
  measureVoiceRates,
  normalisedWpm,
  syllablesIn,
  rateProblems,
  type RateClip,
} from "../lib/content/speech-rate";

/**
 * A clip of `words` words spoken at `wpm`.
 *
 * The duration is derived from *syllables*, because that is what the gate
 * measures: the fixture text is monosyllabic, so building it from words would
 * make `clip("a", 150)` measure 115 and every expectation below a puzzle.
 */
function clip(voiceId: string, wpm: number, words = 6, ownerId = "s_0001"): RateClip {
  const text = Array(words).fill("word").join(" ");
  return {
    voiceId,
    text,
    durationMs: (syllablesIn(text) / SYLLABLES_PER_WORD / wpm) * 60_000,
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
    // Ana at 180 answering Miguel at 120 -- both inside the band, so only the
    // scene check can fire -- and the learner has no way to know a 1.5x gap is
    // an artefact rather than something about the character. (The original
    // case was 132 vs 98, from macOS `say`; 98 now trips the floor first.)
    const clips = [
      clip("ana", 180), clip("ana", 178), clip("ana", 182),
      clip("miguel", 120), clip("miguel", 118), clip("miguel", 122),
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

describe("not accusing anyone on thin evidence", () => {
  test("a scene needs enough clips per voice before comparing them", () => {
    // `s_0006` was flagged at 1.33x on two short Miguel lines, from a voice
    // whose overall rate was within 5% of target. The voice-level check already
    // refused to accuse on fewer than three samples; the scene-level one did not.
    // Both rates sit inside the band, so the only check that could fire is the
    // scene spread — 180/120 is 1.5x, over the limit, with both inside the band.
    const clips: RateClip[] = [
      clip("fast", 180, 8), clip("fast", 180, 8), clip("fast", 180, 8),
      // Only two samples: not enough to say anything about this voice here.
      clip("slow", 120, 8), clip("slow", 120, 8),
    ];
    assert.ok(MIN_SCENE_SAMPLES > 2);
    assert.deepEqual(measureSceneSpreads(clips), []);
    assert.deepEqual(rateProblems(clips, new Map()), []);
  });

  test("but does compare once the evidence is there", () => {
    const clips: RateClip[] = [
      clip("fast", 180, 8), clip("fast", 180, 8), clip("fast", 180, 8),
      clip("slow", 120, 8), clip("slow", 120, 8), clip("slow", 120, 8),
    ];
    const [spread] = measureSceneSpreads(clips);
    assert.ok(spread && spread.ratio > MAX_SCENE_SPREAD);
    assert.ok(rateProblems(clips, new Map()).some((p) => p.where.startsWith("scene:")));
  });

  test("short clips are excluded because packaging dominates them", () => {
    // At 150 wpm a four-word line lasts 1.6s, and ~0.3s of head/tail silence and
    // comma pause is 19% of that. Six words puts it at 12%.
    assert.equal(MIN_WORDS, 6);
    assert.deepEqual(measureVoiceRates([clip("a", 150, 4), clip("a", 150, 5)]), []);
    assert.equal(measureVoiceRates([clip("a", 150, 6)]).length, 1);
  });
});

/**
 * Why the gate counts syllables.
 *
 * Found by authoring `b1_u2`, the numbers unit: it pushed the whole cast from
 * 157 to 176 wpm and every voice looked like a regression, while the physical
 * rate moved 3.24 -> 3.38 syllables per second, which is nothing. The unit is
 * simply monosyllabic -- 1.16 syllables per word against unit 1's 1.26 --
 * because numbers and function words are short.
 *
 * Uncorrected, every unit teaching numbers would fail this gate forever, and a
 * gate that cries wolf gets deleted. This is the same lesson as MIN_WORDS: fix
 * the measurement before accusing the content.
 */
describe("word length does not masquerade as speaking rate", () => {
  test("estimateSyllables handles the shapes this curriculum is made of", () => {
    assert.equal(estimateSyllables("one"), 1);
    assert.equal(estimateSyllables("seven"), 2);
    assert.equal(estimateSyllables("seventeen"), 3);
    assert.equal(estimateSyllables("phone"), 1, "silent final e");
    assert.equal(estimateSyllables("name"), 1);
    assert.equal(estimateSyllables("understand"), 3);
    assert.equal(estimateSyllables(""), 0);
  });

  test("two texts at the same physical rate measure the same", () => {
    // Six monosyllables against six two-syllable words, both spoken at
    // 4 syllables per second. Raw wpm would differ by 2x; this must not.
    const mono = "one two three four five six";        // 6 syllables
    const poly = "seven seven seven seven seven seven"; // 12 syllables
    const a = normalisedWpm(mono, (6 / 4) * 1000);
    const b = normalisedWpm(poly, (12 / 4) * 1000);
    assert.equal(Math.round(a), Math.round(b));
  });

  test("a genuinely faster voice still reads as faster", () => {
    const text = "one two three four five six";
    assert.ok(normalisedWpm(text, 1500) > normalisedWpm(text, 3000));
  });
});
