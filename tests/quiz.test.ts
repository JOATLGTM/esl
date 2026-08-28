import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { pickSceneIndex, shuffleQuestion, type Question } from "../lib/session/quiz";

/**
 * Scene choice and option order, offline.
 *
 * The shuffle exists because b1_u1 shipped with all eighteen comprehension
 * answers at option 1, which let a learner score full marks by always tapping
 * first. These tests are what stop that being reintroduced quietly.
 */

const question: Question = {
  prompt: "¿Cómo se llama la vecina?",
  options: ["Ana", "Rosa", "María"],
  answer: 0,
};

describe("which scene a session plays", () => {
  test("walks the story in order", () => {
    assert.equal(pickSceneIndex(0, 6), 0);
    assert.equal(pickSceneIndex(1, 6), 1);
    assert.equal(pickSceneIndex(5, 6), 5);
  });

  test("wraps rather than running out", () => {
    // A learner who keeps practising a finished unit re-hears the story; the
    // alternative is a stage with nothing in it.
    assert.equal(pickSceneIndex(6, 6), 0);
    assert.equal(pickSceneIndex(13, 6), 1);
  });

  test("survives a unit with no scenes and a nonsense count", () => {
    assert.equal(pickSceneIndex(3, 0), 0);
    assert.equal(pickSceneIndex(-1, 6), 0);
  });
});

describe("option order", () => {
  test("keeps the correct option correct", () => {
    for (const seed of ["a", "b", "c", "session-1:s_0001:0", "zzz"]) {
      const shuffled = shuffleQuestion(seed, question);
      assert.equal(
        shuffled.options[shuffled.answer],
        question.options[question.answer],
        `seed ${seed} moved the answer`,
      );
    }
  });

  test("keeps every option, exactly once", () => {
    const shuffled = shuffleQuestion("seed", question);
    assert.deepEqual([...shuffled.options].sort(), [...question.options].sort());
    assert.equal(shuffled.options.length, question.options.length);
  });

  test("is stable for a seed, so a refresh does not rearrange the answers", () => {
    assert.deepEqual(
      shuffleQuestion("same", question).options,
      shuffleQuestion("same", question).options,
    );
  });

  test("does not leave every answer in the same slot", () => {
    // The actual defect: 18 authored questions, all answered by option 1. Across
    // a spread of seeds the correct option must land somewhere other than first.
    const slots = new Set(
      Array.from({ length: 24 }, (_, i) => shuffleQuestion(`s_${i}`, question).answer),
    );
    assert.ok(slots.size > 1, "the shuffle never moves the answer");
    assert.ok(slots.has(1) || slots.has(2), "the answer is always first");
  });

  test("leaves a question with nothing to shuffle alone", () => {
    const single: Question = { prompt: "?", options: ["only"], answer: 0 };
    assert.deepEqual(shuffleQuestion("seed", single), single);
  });

  test("does not turn an out-of-range answer into a plausible wrong one", () => {
    // The validator errors on this; it must not be silently "fixed" into an
    // option that happens to exist, which would look correct and teach nonsense.
    const broken: Question = { prompt: "?", options: ["a", "b"], answer: 7 };
    assert.equal(shuffleQuestion("seed", broken).answer, 7);
  });
});
