import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  isUnitComplete,
  l1SupportForBlock,
  nextUnit,
  shouldOfferMoreSupport,
  type CurriculumUnit,
} from "../lib/session/progress";

/**
 * The rule that decides whether the product has an end.
 *
 * Without it `current_unit` is written once at onboarding and never again, and
 * a learner who finishes a unit has nowhere to go -- which is precisely the
 * dead end Phase 1's exit criterion is about.
 */

describe("finishing a unit", () => {
  const b1u1 = { newChunks: 0, completedSessions: 6, sceneCount: 6 };

  test("needs every phrase met and the whole story heard", () => {
    assert.equal(isUnitComplete(b1u1), true);
  });

  test("does not move on with phrases the learner has never seen", () => {
    // `pickSceneIndex` wraps, so a learner can cycle the story indefinitely
    // without exhausting Meet. Scenes alone must not be enough.
    assert.equal(isUnitComplete({ ...b1u1, newChunks: 1, completedSessions: 20 }), false);
  });

  test("does not move on before the last scene", () => {
    // The scenes are one continuous afternoon; the final one is the end of
    // something, not a spare exercise.
    assert.equal(isUnitComplete({ ...b1u1, completedSessions: 5 }), false);
  });

  test("does not wait on mastery", () => {
    // Requiring every chunk to reach `learned` would stall a learner behind
    // fifty production passes. The review queue is not unit-scoped, so
    // unmastered chunks keep coming back after the unit is behind them.
    assert.equal(isUnitComplete(b1u1), true);
  });

  test("a unit with no scenes turns on its chunks alone", () => {
    assert.equal(isUnitComplete({ newChunks: 0, completedSessions: 0, sceneCount: 0 }), true);
    assert.equal(isUnitComplete({ newChunks: 3, completedSessions: 9, sceneCount: 0 }), false);
  });
});

describe("where the learner goes next", () => {
  const curriculum: CurriculumUnit[] = [
    { id: "b2_u1", block: 2, order: 1 },
    { id: "b1_u2", block: 1, order: 2 },
    { id: "b1_u1", block: 1, order: 1 },
  ];

  test("walks curriculum order, not insertion order", () => {
    assert.equal(nextUnit(curriculum, "b1_u1")?.id, "b1_u2");
    assert.equal(nextUnit(curriculum, "b1_u2")?.id, "b2_u1");
  });

  test("crosses a block boundary and reports the new block", () => {
    assert.equal(nextUnit(curriculum, "b1_u2")?.block, 2);
  });

  test("returns null at the end of what is authored", () => {
    // Today's actual state after one unit. A real state, not an error: the
    // caller has to keep the learner somewhere coherent.
    assert.equal(nextUnit(curriculum, "b2_u1"), null);
    assert.equal(nextUnit([{ id: "b1_u1", block: 1, order: 1 }], "b1_u1"), null);
  });

  test("sends a learner with no unit to the beginning", () => {
    assert.equal(nextUnit(curriculum, null)?.id, "b1_u1");
  });

  test("sends a learner on a retired unit to the beginning rather than stranding them", () => {
    assert.equal(nextUnit(curriculum, "b9_u9")?.id, "b1_u1");
  });

  test("an empty curriculum yields nowhere to go", () => {
    assert.equal(nextUnit([], "b1_u1"), null);
    assert.equal(nextUnit([], null), null);
  });
});

describe("the Spanish taper", () => {
  test("follows the curriculum's own levels", () => {
    // content/curriculum.yaml: blocks 1 and 2 are level 1, then one per block.
    assert.equal(l1SupportForBlock(1), 1);
    assert.equal(l1SupportForBlock(2), 1);
    assert.equal(l1SupportForBlock(3), 2);
    assert.equal(l1SupportForBlock(6), 5);
  });

  test("stays inside the column's CHECK whatever it is handed", () => {
    // `l1_support_level between 1 and 5`; a bad block must not produce a write
    // the database rejects.
    for (const block of [-3, 0, 1, 6, 9, 99]) {
      const level = l1SupportForBlock(block);
      assert.ok(level >= 1 && level <= 5, `block ${block} gave ${level}`);
    }
  });

  test("offers more Spanish to someone revealing most glosses", () => {
    assert.equal(shouldOfferMoreSupport(20, 14, 3), true);
  });

  test("does not offer on thin evidence", () => {
    // Being wrong here means telling someone who is fine that they look lost.
    assert.equal(shouldOfferMoreSupport(4, 4, 3), false);
  });

  test("does not offer to someone who is coping", () => {
    assert.equal(shouldOfferMoreSupport(20, 3, 3), false);
  });

  test("has nothing to offer at the most supported level", () => {
    assert.equal(shouldOfferMoreSupport(50, 50, 1), false);
  });
});
