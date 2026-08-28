import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { ERROR_PATTERNS, classifyError } from "../lib/content/error-patterns";

/**
 * L1 interference detection (PRD F6).
 *
 * The risk this file guards against is not missing an error -- it is inventing
 * one. A pattern that fires on a correct answer teaches a learner that they got
 * something wrong when they did not, which is worse than recording nothing.
 */

describe("catching real Spanish-to-English transfers", () => {
  const cases: [string, string, string][] = [
    ["I am 20 years old", "I have 20 years", "have_years_for_age"],
    ["I'm fine, thank you", "Am fine, thank you", "dropped_subject"],
    ["I am a student", "I am student", "missing_article"],
    ["He works here", "He work here", "missing_third_person_s"],
    ["Can you explain it to me?", "Can you explain me?", "missing_preposition_to"],
    ["People are nice", "People is nice", "people_is"],
    ["What do you want?", "What you want?", "missing_do_support"],
    ["a red car", "a car red", "adjective_after_noun"],
  ];

  for (const [expected, actual, key] of cases) {
    test(`"${actual}" -> ${key}`, () => {
      assert.equal(classifyError(expected, actual), key);
    });
  }
});

describe("not inventing errors", () => {
  test("a correct answer is never classified", () => {
    for (const [expected] of [
      ["I am 20 years old"],
      ["He works here"],
      ["a red car"],
      ["People are nice"],
      ["What do you want?"],
    ]) {
      assert.equal(classifyError(expected, expected), null, `flagged a correct answer: ${expected}`);
    }
  });

  test("a merely different phrase is not a pattern", () => {
    // Most wrong answers are just a different phrase. Inventing a category for
    // them would bury the real signal.
    assert.equal(classifyError("Good morning", "Good night"), null);
    assert.equal(classifyError("Hello", "Goodbye"), null);
  });

  test("an empty answer is not a pattern", () => {
    assert.equal(classifyError("Hello", ""), null);
    assert.equal(classifyError("Hello", "   "), null);
  });

  test("does not fire when the expected answer has the same shape", () => {
    // "the red car" would match adjective_after_noun by regex alone; the
    // expected-answer guard is the only thing stopping it.
    assert.equal(classifyError("I saw a red car", "I see a red car"), null);
  });
});

describe("the pattern config itself", () => {
  test("keys are unique and stable-looking", () => {
    const keys = ERROR_PATTERNS.map((p) => p.key);
    assert.equal(new Set(keys).size, keys.length, "duplicate pattern key");
    for (const key of keys) assert.match(key, /^[a-z0-9_]+$/, `${key} is not a stable key`);
  });

  test("no pattern carries the global flag", () => {
    // A /g regex keeps `lastIndex` between calls, so the same input would
    // match on one call and not the next -- a bug that only shows up in
    // production, on the second learner.
    for (const p of ERROR_PATTERNS) assert.ok(!p.test.global, `${p.key} uses /g`);
  });

  test("every pattern explains itself in Spanish", () => {
    for (const p of ERROR_PATTERNS) assert.ok(p.labelEs.length > 10, `${p.key} has no explanation`);
  });
});
