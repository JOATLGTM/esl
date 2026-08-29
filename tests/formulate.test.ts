import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  FORMULATION_COUNT,
  FORMULATION_SECONDS,
  pickFormulation,
  type FormulationPrompt,
} from "../lib/session/formulate";

const pool: FormulationPrompt[] = [
  { chunkId: "c_0001", es: "Hola", en: "Hello", audioUrl: "/a/1.opus" },
  { chunkId: "c_0002", es: "Gracias", en: "Thank you", audioUrl: null },
  { chunkId: "c_0003", es: "No entiendo", en: "I don't understand", audioUrl: "/a/3.opus" },
  { chunkId: "c_0004", es: "Estoy perdido", en: "I am lost", audioUrl: "/a/4.opus" },
  { chunkId: "c_0005", es: "Un momento", en: "One moment", audioUrl: null },
  { chunkId: "c_0006", es: "Tengo hambre", en: "I am hungry", audioUrl: "/a/6.opus" },
  { chunkId: "c_0007", es: "¿Cuánto es?", en: "How much is it?", audioUrl: "/a/7.opus" },
];

describe("pickFormulation", () => {
  test("deals the same hand for the same session", () => {
    assert.deepEqual(pickFormulation(pool, "session-1"), pickFormulation(pool, "session-1"));
  });

  test("a different session sees a different hand", () => {
    const first = new Set(
      Array.from({ length: 10 }, (_, i) => pickFormulation(pool, `s${i}`)[0].chunkId),
    );
    assert.ok(first.size > 1);
  });

  test(`caps at ${FORMULATION_COUNT}`, () => {
    assert.equal(pickFormulation(pool, "s").length, FORMULATION_COUNT);
  });

  test("never repeats a chunk", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const ids = pickFormulation(pool, seed).map((p) => p.chunkId);
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  test("offers everything when the pool is smaller than the hand", () => {
    assert.equal(pickFormulation(pool.slice(0, 2), "s").length, 2);
  });

  test("prefers chunks with a model clip, without excluding the rest", () => {
    const hand = pickFormulation(pool, "s");
    const firstSilent = hand.findIndex((p) => !p.audioUrl);
    const lastVoiced = hand.map((p) => !!p.audioUrl).lastIndexOf(true);
    if (firstSilent !== -1) assert.ok(lastVoiced < firstSilent, "voiced should come first");
    // With 5 voiced of 7 and a hand of 5, the silent ones may not appear at
    // all -- but a small pool of only silent chunks must still deal.
    assert.equal(pickFormulation([pool[1], pool[4]], "s").length, 2);
  });

  test("drops a prompt with nothing to say or nothing to reveal", () => {
    const bad: FormulationPrompt[] = [
      { chunkId: "x", es: "  ", en: "Hi", audioUrl: null },
      { chunkId: "y", es: "Hola", en: "", audioUrl: null },
    ];
    assert.deepEqual(pickFormulation(bad, "s"), []);
  });

  test("an empty pool is an empty hand, not an error", () => {
    assert.deepEqual(pickFormulation([], "s"), []);
  });

  test("the clock sits just above the archetype's four-second gap", () => {
    assert.ok(FORMULATION_SECONDS >= 4 && FORMULATION_SECONDS <= 8);
  });
});
