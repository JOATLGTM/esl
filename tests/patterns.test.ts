import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  MAX_PATTERNS,
  PATTERN_THRESHOLD,
  summarisePatterns,
  type ErrorEvent,
} from "../lib/session/patterns";

const event = (errorType: string, userText = "x", correctedText = "y"): ErrorEvent => ({
  errorType,
  userText,
  correctedText,
});

describe("what counts as a pattern", () => {
  test("one slip is not a pattern", () => {
    // A bad morning is not evidence of anything, and telling someone it is
    // would be both wrong and discouraging.
    assert.deepEqual(summarisePatterns([event("dropped_subject")]), []);
  });

  test("two is", () => {
    const out = summarisePatterns([event("dropped_subject"), event("dropped_subject")]);
    assert.equal(out.length, 1);
    assert.equal(out[0].times, PATTERN_THRESHOLD);
  });

  test("shows at most three, most frequent first", () => {
    // Someone shown eight things to fix fixes none of them.
    const events = [
      ...Array(2).fill(event("people_is")),
      ...Array(5).fill(event("dropped_subject")),
      ...Array(3).fill(event("missing_article")),
      ...Array(4).fill(event("have_years_for_age")),
    ];
    const out = summarisePatterns(events);
    assert.equal(out.length, MAX_PATTERNS);
    assert.deepEqual(
      out.map((p) => p.key),
      ["dropped_subject", "have_years_for_age", "missing_article"],
    );
  });
});

describe("what it shows", () => {
  test("the learner's own most recent words", () => {
    // Events arrive newest-first; an old attempt they have moved past would be
    // unfair as well as unhelpful.
    const out = summarisePatterns([
      event("dropped_subject", "Am fine", "I'm fine"),
      event("dropped_subject", "Am tired", "I'm tired"),
    ]);
    assert.equal(out[0].example, "Am fine");
    assert.equal(out[0].correction, "I'm fine");
  });

  test("explains the rule, in Spanish", () => {
    const out = summarisePatterns([event("people_is"), event("people_is")]);
    assert.match(out[0].explanationEs, /people/i);
    assert.ok(out[0].explanationEs.length > 10);
  });

  test("reports no count of failures beyond how often the rule applies", () => {
    const out = summarisePatterns([event("people_is"), event("people_is")]);
    assert.deepEqual(Object.keys(out[0]).sort(), [
      "correction",
      "example",
      "explanationEs",
      "key",
      "times",
    ]);
  });
});

describe("robustness", () => {
  test("skips a retired rule whose rows outlived it", () => {
    // The database keeps the history; the learner does not need to see a rule
    // nobody maintains.
    assert.deepEqual(summarisePatterns([event("gone_rule"), event("gone_rule")]), []);
  });

  test("survives a missing correction", () => {
    const out = summarisePatterns([
      { errorType: "people_is", userText: "People is nice", correctedText: null },
      { errorType: "people_is", userText: "People is nice", correctedText: null },
    ]);
    assert.equal(out[0].correction, "");
  });

  test("an empty history shows nothing", () => {
    assert.deepEqual(summarisePatterns([]), []);
  });
});
