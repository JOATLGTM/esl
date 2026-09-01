import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { modeFor } from "../lib/session/review-mode";

const card = (reps: number, state: "new" | "learning" | "review" | "learned") =>
  ({ reps, state }) as Parameters<typeof modeFor>[0];

describe("the review ladder", () => {
  test("first sight is recognition -- reproducing it cold teaches him he is bad at this", () => {
    assert.equal(modeFor(card(0, "new"), true), "recognize");
  });

  test("after that, typed production, because only production matures a card", () => {
    assert.equal(modeFor(card(3, "learning"), true), "produce_typed");
    assert.equal(modeFor(card(8, "review"), true), "produce_typed");
  });

  test("a learned card with audio comes back as dictation", () => {
    assert.equal(modeFor(card(12, "learned"), true), "dictation");
  });

  test("a learned card without a clip stays typed -- a dictation with nothing to play is a blank stare", () => {
    assert.equal(modeFor(card(12, "learned"), false), "produce_typed");
  });

  test("dictation never appears before mastery, so it can never stall the ladder", () => {
    // countsAsProduction refuses dictation, so if it appeared during
    // `learning` it would burn reviews that cannot mature the card.
    for (const state of ["new", "learning", "review"] as const) {
      assert.notEqual(modeFor(card(5, state), true), "dictation");
    }
  });
});
