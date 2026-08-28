import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { buildOptions, canBuildRecognition, confusable } from "../lib/session/distractors";

/** The first six chunks of b1_u1, in curriculum order — day one's Meet. */
const DAY_ONE = [
  "Hola",
  "Hola (informal)",
  "Buenos días",
  "Buenas tardes",
  "Buenas noches (al despedirse)",
  "Adiós",
];

describe("telling glosses apart", () => {
  test("a parenthetical is not a difference a learner can see", () => {
    // The bug that shipped: "Hello" is glossed `Hola`, "Hi" is glossed
    // `Hola (informal)`, and both were offered as answers to the same card.
    assert.equal(confusable("Hola", "Hola (informal)"), true);
    assert.equal(confusable("Buenas noches (al despedirse)", "Buenas noches"), true);
  });

  test("genuinely different glosses are not confusable", () => {
    assert.equal(confusable("Hola", "Adiós"), false);
    assert.equal(confusable("Buenos días", "Buenas tardes"), false);
    assert.equal(confusable("Gracias", "De nada"), false);
  });

  test("accents and case do not make two glosses different", () => {
    assert.equal(confusable("Adiós", "adios"), true);
  });

  test("a gloss that is only a parenthetical is treated as confusable with anything", () => {
    // It has no base form, so it cannot be told apart from anything. Better to
    // never offer it than to offer an option that reads as blank.
    assert.equal(confusable("(informal)", "Hola"), true);
  });
});

describe("building a recognition card", () => {
  test("never offers a gloss confusable with the answer", () => {
    // The exact failure, across many seeds.
    for (let s = 0; s < 300; s++) {
      const { values } = buildOptions(`session-${s}:c_0001`, "Hola", DAY_ONE);
      assert.ok(
        !values.includes("Hola (informal)"),
        `seed ${s} offered both Hola and Hola (informal)`,
      );
    }
  });

  test("never offers the same distractor twice", () => {
    // The old version indexed `others[(start+1) % others.length]` unguarded, so
    // a two-gloss pool produced ["Adiós","Adiós","Hola"] and a duplicate key.
    for (const pool of [["Hola", "Adiós"], DAY_ONE, ["Hola", "Adiós", "Gracias"]]) {
      for (let s = 0; s < 50; s++) {
        const { values } = buildOptions(`s${s}`, "Hola", pool);
        assert.equal(new Set(values).size, values.length, `duplicate in ${JSON.stringify(values)}`);
      }
    }
  });

  test("shows fewer options rather than a bad one", () => {
    const { values, answer } = buildOptions("seed", "Hola", ["Hola", "Adiós"]);
    assert.deepEqual([...values].sort(), ["Adiós", "Hola"]);
    assert.equal(values[answer], "Hola");
  });

  test("keeps the answer correct wherever it lands", () => {
    for (let s = 0; s < 300; s++) {
      const { values, answer } = buildOptions(`s${s}`, "Hola", DAY_ONE);
      assert.equal(values[answer], "Hola", `seed ${s} lost the answer`);
    }
  });

  test("does not always put the answer first", () => {
    const slots = new Set(
      Array.from({ length: 60 }, (_, s) => buildOptions(`s${s}`, "Hola", DAY_ONE).answer),
    );
    assert.ok(slots.size > 1, "the answer never moves");
  });

  test("is stable for a seed, so a refresh does not rearrange the options", () => {
    assert.deepEqual(
      buildOptions("same", "Hola", DAY_ONE).values,
      buildOptions("same", "Hola", DAY_ONE).values,
    );
  });

  test("distractors are distinguishable from each other, not just from the answer", () => {
    const pool = ["Gracias", "Hola", "Hola (informal)", "Adiós"];
    for (let s = 0; s < 100; s++) {
      const { values } = buildOptions(`s${s}`, "Gracias", pool);
      const hasBoth = values.includes("Hola") && values.includes("Hola (informal)");
      assert.ok(!hasBoth, `seed ${s} offered two glosses the learner cannot separate`);
    }
  });
});

describe("when a card cannot be a multiple choice", () => {
  test("a pool with nothing usable is refused", () => {
    // One option is not a question.
    assert.equal(canBuildRecognition("Hola", ["Hola", "Hola (informal)"]), false);
    assert.equal(canBuildRecognition("Hola", ["Hola"]), false);
    assert.equal(canBuildRecognition("Hola", []), false);
  });

  test("one clean distractor is enough to ask", () => {
    assert.equal(canBuildRecognition("Hola", ["Hola", "Adiós"]), true);
  });
});
