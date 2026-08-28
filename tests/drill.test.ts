import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  RECENT_WINDOW,
  buildDrill,
  drillBudget,
  foldDrillResults,
  type MinimalPair,
} from "../lib/session/drill";

/**
 * High-variability phonetic training, offline.
 *
 * None of this can be checked against real content yet -- there are zero human
 * recordings -- so these tests are the only thing standing between the drill
 * and a silent regression the day the clips land.
 */

const SPEAKERS = ["hs_01", "hs_02", "hs_03", "hs_04", "hs_05", "hs_06"];

function pair(id: string, a: string, b: string, speakers = SPEAKERS): MinimalPair {
  return {
    id,
    wordA: a,
    wordB: b,
    ipaA: `/${a}/`,
    ipaB: `/${b}/`,
    audio: speakers.flatMap((speakerId) => [
      { speakerId, word: a, url: `/audio/${id}-${a}-${speakerId}.opus` },
      { speakerId, word: b, url: `/audio/${id}-${b}-${speakerId}.opus` },
    ]),
  };
}

const pairs = [
  pair("mp_1", "sheep", "ship"),
  pair("mp_2", "seat", "sit"),
  pair("mp_3", "feel", "fill"),
];

describe("building a drill", () => {
  test("never plays the same speaker twice in a row", () => {
    // The one rule the whole exercise depends on. A drill that repeats a talker
    // still looks and feels correct and teaches substantially less.
    for (const seed of ["a", "b", "session-1", "zzz", "42"]) {
      const items = buildDrill(pairs, 12, seed);
      assert.ok(items.length > 0, `seed ${seed} produced nothing`);
      for (let i = 1; i < items.length; i++) {
        assert.notEqual(
          items[i].speakerId,
          items[i - 1].speakerId,
          `seed ${seed} repeated ${items[i].speakerId} at ${i}`,
        );
      }
    }
  });

  test("plays a clip of the word it says it played", () => {
    for (const item of buildDrill(pairs, 12, "seed")) {
      const word = item.target === "a" ? item.wordA : item.wordB;
      assert.ok(
        item.url.includes(`-${word}-`),
        `item claims ${item.target} (${word}) but plays ${item.url}`,
      );
    }
  });

  test("asks about both words, not just the first", () => {
    const targets = new Set(buildDrill(pairs, 12, "seed").map((i) => i.target));
    assert.deepEqual([...targets].sort(), ["a", "b"]);
  });

  test("produces nothing at all when no recordings exist", () => {
    // Today's actual state. The stage is skipped rather than shown empty.
    const silent = pairs.map((p) => ({ ...p, audio: [] }));
    assert.deepEqual(buildDrill(silent, 10, "seed"), []);
  });

  test("would rather run short than repeat a talker", () => {
    // A single speaker cannot produce a valid drill of more than one item.
    const oneVoice = [pair("mp_1", "sheep", "ship", ["hs_01"])];
    const items = buildDrill(oneVoice, 10, "seed");
    assert.equal(items.length, 1);
  });

  test("scales with the daily goal", () => {
    assert.equal(drillBudget(10), 6);
    assert.equal(drillBudget(20), 10);
    assert.equal(drillBudget(30), 14);
  });
});

describe("progress on a contrast", () => {
  const fresh = { attempts: 0, correct: 0, recent: [] as boolean[], retiredAt: null };
  const NOW = "2026-08-28T00:00:00.000Z";

  test("keeps a trailing window, not a lifetime ratio", () => {
    // A lifetime ratio hides a learner who has just cracked a contrast they
    // used to fail, which is exactly when they should stop drilling it.
    const many = foldDrillResults(fresh, Array(50).fill(true), NOW);
    assert.equal(many.recent.length, RECENT_WINDOW);
    assert.equal(many.attempts, 50);
    assert.equal(many.correct, 50);
  });

  test("retires a contrast at 90% over a full window", () => {
    const results = [...Array(27).fill(true), ...Array(3).fill(false)];
    const stats = foldDrillResults(fresh, results, NOW);
    assert.equal(stats.recent.length, 30);
    assert.equal(stats.retiredAt, NOW);
  });

  test("does not retire on a short window, however perfect", () => {
    // Ten out of ten is not evidence; it is a good morning.
    const stats = foldDrillResults(fresh, Array(10).fill(true), NOW);
    assert.equal(stats.retiredAt, null);
  });

  test("does not retire below the threshold", () => {
    const results = [...Array(26).fill(true), ...Array(4).fill(false)];
    assert.equal(foldDrillResults(fresh, results, NOW).retiredAt, null);
  });

  test("does not re-stamp a contrast that is already retired", () => {
    const already = { attempts: 30, correct: 30, recent: Array(30).fill(true), retiredAt: "2026-01-01T00:00:00.000Z" };
    const stats = foldDrillResults(already, [true], NOW);
    assert.equal(stats.retiredAt, "2026-01-01T00:00:00.000Z");
  });

  test("counts a failed drill honestly", () => {
    const stats = foldDrillResults(fresh, [false, false, true], NOW);
    assert.equal(stats.attempts, 3);
    assert.equal(stats.correct, 1);
    assert.deepEqual(stats.recent, [false, false, true]);
  });
});
