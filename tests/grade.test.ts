import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  RATING,
  cardStateFor,
  countsAsProduction,
  gradeTypedAnswer,
  normalise,
  ratingFor,
} from "../lib/session/grade";

/**
 * Marking, offline.
 *
 * This is where a language app quietly becomes cruel, so every case here is a
 * learner who deserved to be told they were right.
 */

describe("normalising an answer", () => {
  test("ignores case, punctuation and spacing", () => {
    assert.equal(normalise("I'm fine, thank you."), normalise("im fine thank you"));
    assert.equal(normalise("  Hello!  "), "hello");
    assert.equal(normalise("What's your name?"), "whats your name");
  });

  test("ignores accents a Spanish keyboard adds by habit", () => {
    assert.equal(normalise("cafe"), normalise("café"));
  });
});

describe("marking a typed answer", () => {
  test("accepts the phrase however it was punctuated", () => {
    assert.equal(gradeTypedAnswer("I'm fine, thank you.", "im fine thank you"), "correct");
    assert.equal(gradeTypedAnswer("Good morning", "good morning"), "correct");
  });

  test("forgives a typo in a long phrase", () => {
    // A fat thumb on a phone keyboard is not a failure to know the phrase.
    assert.equal(gradeTypedAnswer("Nice to meet you, Miguel", "Nice to meet yu, Miguel"), "close");
  });

  test("does not forgive a typo that is most of a short word", () => {
    // In "Hi", one wrong letter is a different answer entirely.
    assert.equal(gradeTypedAnswer("Hi", "Ho"), "wrong");
  });

  test("rejects a different phrase", () => {
    assert.equal(gradeTypedAnswer("Good morning", "Good night"), "wrong");
    assert.equal(gradeTypedAnswer("Hello", "Goodbye"), "wrong");
  });

  test("treats an empty answer as wrong rather than correct", () => {
    // Guard against normalise() reducing punctuation-only input to "" and
    // matching an expected value that also normalised to "".
    assert.equal(gradeTypedAnswer("Hello", ""), "wrong");
    assert.equal(gradeTypedAnswer("Hello", "   "), "wrong");
    assert.equal(gradeTypedAnswer("Hello", "!!!"), "wrong");
  });
});

describe("what an outcome means", () => {
  test("maps onto FSRS ratings", () => {
    assert.equal(ratingFor("correct"), RATING.Good);
    assert.equal(ratingFor("close"), RATING.Hard);
    assert.equal(ratingFor("wrong"), RATING.Again);
  });

  test("only production counts toward mastery", () => {
    // PRD F2, and the database enforces it independently.
    assert.equal(countsAsProduction("recognize", "correct"), false);
    assert.equal(countsAsProduction("produce_typed", "correct"), true);
    assert.equal(countsAsProduction("produce_spoken", "correct"), true);
  });

  test("a near-miss still counts as having produced the phrase", () => {
    assert.equal(countsAsProduction("produce_typed", "close"), true);
    assert.equal(countsAsProduction("produce_typed", "wrong"), false);
  });
});

describe("card maturity", () => {
  const REVIEW = 2; // State.Review
  const LEARNING = 1;

  test("never claims learned without two production passes", () => {
    // The `learned_requires_production` CHECK would reject the write anyway;
    // this is what stops the app generating a write the database refuses.
    assert.equal(cardStateFor(0, REVIEW), "review");
    assert.equal(cardStateFor(1, REVIEW), "review");
    assert.equal(cardStateFor(2, REVIEW), "learned");
  });

  test("does not claim learned while the scheduler is still learning it", () => {
    assert.equal(cardStateFor(5, LEARNING), "learning");
  });
});

describe("a transfer error is not a typo", () => {
  test("dropping the subject pronoun is wrong, not close", () => {
    // One character from the right answer, and well inside the typo budget --
    // but Spanish omits the subject and English cannot, so this is the thing
    // the course exists to correct, not a slip of the thumb.
    assert.equal(gradeTypedAnswer("I'm fine, thank you", "Am fine, thank you"), "wrong");
  });

  test("so it cannot count toward mastery", () => {
    // The whole reason this matters: `close` counts as production, so a
    // learner could reach `learned` while making the same structural error
    // every single time.
    const outcome = gradeTypedAnswer("I'm fine, thank you", "Am fine, thank you");
    assert.equal(countsAsProduction("produce_typed", outcome), false);
  });

  test("an ordinary typo is still forgiven", () => {
    assert.equal(gradeTypedAnswer("Nice to meet you, Miguel", "Nice to meet yu, Miguel"), "close");
  });

  test("a correct answer is still correct", () => {
    assert.equal(gradeTypedAnswer("I'm fine, thank you", "im fine thank you"), "correct");
  });
});
