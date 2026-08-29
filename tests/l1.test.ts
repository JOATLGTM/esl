import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  L1_CHOICES,
  MAX_L1_LEVEL,
  MIN_L1_LEVEL,
  l1Support,
  moreSupport,
  nearestChoice,
} from "../lib/session/l1";
import { l1SupportForBlock, shouldOfferMoreSupport } from "../lib/session/progress";

describe("l1Support", () => {
  test("the most supported level offers the gloss and asks in Spanish", () => {
    const s = l1Support(1);
    assert.equal(s.offerGloss, true);
    assert.equal(s.spanishQuestions, true);
  });

  test("the least supported level withdraws the gloss offer", () => {
    const s = l1Support(5);
    assert.equal(s.offerGloss, false);
    assert.equal(s.spanishQuestions, false);
  });

  test("the gloss survives every level but the last", () => {
    for (const level of [1, 2, 3, 4]) {
      assert.equal(l1Support(level).offerGloss, true, `level ${level} should still offer it`);
    }
  });

  test("clamps rather than throwing -- a bad level still renders a screen", () => {
    assert.equal(l1Support(0).level, MIN_L1_LEVEL);
    assert.equal(l1Support(99).level, MAX_L1_LEVEL);
    assert.equal(l1Support(NaN).level, MIN_L1_LEVEL);
  });

  test("every level the curriculum can produce is a valid one", () => {
    for (let block = 1; block <= 6; block++) {
      const level = l1SupportForBlock(block);
      assert.equal(l1Support(level).level, level, `block ${block} produced an unusable level`);
    }
  });
});

describe("what the learner is offered", () => {
  test("three choices, spanning the range", () => {
    assert.deepEqual([...L1_CHOICES], [1, 3, 5]);
  });

  test("an automatic level maps onto something sayable", () => {
    assert.equal(nearestChoice(1), 1);
    assert.equal(nearestChoice(2), 1);
    assert.equal(nearestChoice(3), 3);
    assert.equal(nearestChoice(4), 3);
    assert.equal(nearestChoice(5), 5);
  });

  test("more support is one step, never a reset", () => {
    assert.equal(moreSupport(5), 4);
    assert.equal(moreSupport(3), 2);
  });

  test("and it stops at the most supported level", () => {
    assert.equal(moreSupport(1), 1);
    assert.equal(moreSupport(0), 1);
  });
});

describe("the offer and the taper agree", () => {
  test("a learner at full support is never offered more", () => {
    // There is nothing to offer, and asking would imply there was.
    assert.equal(shouldOfferMoreSupport(50, 50, MIN_L1_LEVEL), false);
  });

  test("a struggling learner above it is", () => {
    assert.equal(shouldOfferMoreSupport(20, 14, 3), true);
    assert.ok(moreSupport(3) < 3, "the offer has somewhere to go");
  });
});
