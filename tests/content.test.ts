import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { tokenize, tokenizeTranscript, stripSpeakerLabel, morphologicalVariants } from "../lib/content/tokenize";
import { classifyCognate, isCognate } from "../lib/content/cognates";
import { scoreTokens, scoreTranscript, unknownBudget, cognateCreditAllowed } from "../lib/content/readability";
import { buildKnownWordTimeline, loadContent, unitChunkWords } from "../lib/content/load";

describe("tokenize", () => {
  test("lowercases and drops punctuation", () => {
    assert.deepEqual(tokenize("Hello, Ana! How are you?"), ["hello", "ana", "how", "are", "you"]);
  });

  test("expands contractions so I'm credits I + am", () => {
    assert.deepEqual(tokenize("I'm fine"), ["i", "am", "fine"]);
    assert.deepEqual(tokenize("I don't understand"), ["i", "do", "not", "understand"]);
    assert.deepEqual(tokenize("What's your name?"), ["what", "is", "your", "name"]);
  });

  test("drops digits -- numerals are not vocabulary", () => {
    assert.deepEqual(tokenize("I am 20 years old"), ["i", "am", "years", "old"]);
  });

  test("strips speaker labels but keeps the line", () => {
    assert.equal(stripSpeakerLabel("A: Good morning."), "Good morning.");
    assert.equal(stripSpeakerLabel("Ana: Good morning."), "Good morning.");
    assert.equal(stripSpeakerLabel("No label here"), "No label here");
  });

  test("a speaker label never leaks into the token stream", () => {
    const tokens = tokenizeTranscript("A: Hello.\nB: Hi.");
    assert.deepEqual(tokens, ["hello", "hi"]);
  });

  test("morphological variants map inflections back to the base form", () => {
    assert.ok(morphologicalVariants("names").includes("name"));
    assert.ok(morphologicalVariants("worked").includes("work"));
    assert.ok(morphologicalVariants("running").includes("runn"));
    assert.ok(morphologicalVariants("studies").includes("study"));
  });
});

describe("cognates", () => {
  test("curated cognates are free", () => {
    assert.equal(isCognate("hospital"), true);
    assert.equal(isCognate("important"), true);
  });

  test("suffix rules generalize beyond the curated list", () => {
    const v = classifyCognate("celebration");
    assert.deepEqual([v.cognate, v.cognate && v.via], [true, "suffix"]);
  });

  test("suffix rules do not fire on short words", () => {
    // `al` and `ic` would otherwise swallow half the closed-class vocabulary.
    assert.equal(isCognate("pal"), false);
    assert.equal(isCognate("tic"), false);
  });

  test("false friends beat every other rule", () => {
    // `embarrassed` looks like embarazada; `actually` looks like actualmente.
    // Counting these as known would score a sentence the learner misreads.
    assert.deepEqual(classifyCognate("embarrassed"), { cognate: false, reason: "false_friend" });
    assert.deepEqual(classifyCognate("actually"), { cognate: false, reason: "false_friend" });
    // `library` ends in -ary, which is a live suffix rule. The denylist wins.
    assert.deepEqual(classifyCognate("library"), { cognate: false, reason: "false_friend" });
  });

  test("proper nouns are free", () => {
    const v = classifyCognate("miguel");
    assert.deepEqual([v.cognate, v.cognate && v.via], [true, "proper_noun"]);
  });

  test("plain Germanic vocabulary is not a cognate", () => {
    for (const w of ["breakfast", "shop", "want", "brother"]) {
      assert.equal(isCognate(w), false, `${w} should not count as a cognate`);
    }
  });
});

describe("readability gate", () => {
  const known = new Set(["i", "am", "fine", "thank", "you", "and", "how", "are"]);

  test("all-known text scores 1.0", () => {
    const r = scoreTokens(tokenize("I'm fine, thank you. And you?"), known);
    assert.equal(r.score, 1);
    assert.equal(r.passes, true);
  });

  test("one unknown word in a short item fails the gate", () => {
    // 5 tokens, budget 0. This is the gate doing its job, not a bug.
    const r = scoreTokens(tokenize("How are you today friend"), known);
    assert.equal(r.passes, false);
    assert.deepEqual(r.unknown, ["today", "friend"]);
  });

  test("cognate credit can rescue an item, and is withdrawn at A2+", () => {
    const text = "I am fine, thank you. The hospital is important.";
    const withCredit = scoreTokens(tokenize(text), known, { countCognates: true });
    const without = scoreTokens(tokenize(text), known, { countCognates: false });
    assert.ok(withCredit.cognate >= 2);
    assert.equal(without.cognate, 0);
    assert.ok(withCredit.score > without.score);
  });

  test("cognate credit window matches the taper", () => {
    for (const level of ["A0", "A1", "A1+", "A2"]) assert.equal(cognateCreditAllowed(level), true);
    for (const level of ["A2+", "B1"]) assert.equal(cognateCreditAllowed(level), false);
  });

  test("empty content is broken content, not perfectly readable", () => {
    const r = scoreTokens([], known);
    assert.equal(r.passes, false);
    assert.equal(r.score, 0);
  });

  test("unknown budget is the floor of 5% of length", () => {
    assert.equal(unknownBudget(10), 0);
    assert.equal(unknownBudget(20), 1);
    assert.equal(unknownBudget(60), 3);
  });

  test("inflections of a known base word count as known", () => {
    const r = scoreTokens(tokenize("names"), new Set(["name"]));
    assert.equal(r.known, 1);
  });
});

describe("curriculum known-word timeline", () => {
  const bundle = loadContent();
  const timeline = buildKnownWordTimeline(bundle.units);

  test("the first unit starts from nothing", () => {
    assert.equal(timeline.before.get("b1_u1")!.size, 0);
  });

  test("a unit's own chunks are known by the time its scenes play", () => {
    // Stage 2 (Meet) runs before Stage 3 (Absorb) in the same session.
    const during = timeline.during.get("b1_u1")!;
    for (const w of unitChunkWords(bundle.unitsById.get("b1_u1")!)) {
      assert.ok(during.has(w), `${w} should be known during b1_u1`);
    }
  });

  test("every authored scene clears the 95% gate", () => {
    for (const unit of bundle.units) {
      const during = timeline.during.get(unit.unit_id)!;
      for (const scene of unit.scenes) {
        const r = scoreTranscript(scene.transcript, during);
        assert.ok(
          r.passes,
          `${unit.unit_id}/${scene.id} scored ${(r.score * 100).toFixed(1)}%: ${r.unknown.join(", ")}`
        );
      }
    }
  });

  test("the gate actually bites -- a scene with real English fails", () => {
    const during = timeline.during.get("b1_u1")!;
    const r = scoreTranscript(
      "A: Would you like a cup of coffee before the meeting starts?\nB: Absolutely, milk and two sugars.",
      during
    );
    assert.equal(r.passes, false);
  });
});
