import assert from "node:assert/strict";
import { test, describe } from "node:test";

import {
  buildFrameDrill,
  pickFrameIndex,
  promptFor,
  MAX_FRAME_OPTIONS,
  type SessionFrame,
} from "../lib/session/frame-drill";

const frame: SessionFrame = {
  id: "f_0001",
  pattern: "I'd like {NP}, please.",
  esPattern: "Me gustaría {NP}, por favor.",
  slot: "NP",
  fillers: [
    { key: "c_0001", text: "a coffee" },
    { key: "c_0002", text: "a tea" },
    { key: "c_0003", text: "water" },
    { key: "c_0004", text: "the bill" },
    { key: "c_0005", text: "a sandwich" },
    { key: "c_0006", text: "the menu" },
    { key: "c_0007", text: "a table" },
  ],
};

describe("pickFrameIndex", () => {
  test("takes frames in order and wraps", () => {
    assert.equal(pickFrameIndex(0, 3), 0);
    assert.equal(pickFrameIndex(2, 3), 2);
    assert.equal(pickFrameIndex(3, 3), 0);
  });

  test("survives a unit with no frames", () => {
    assert.equal(pickFrameIndex(4, 0), 0);
  });

  test("survives a negative count from a bad query", () => {
    assert.equal(pickFrameIndex(-1, 3), 0);
  });
});

describe("promptFor", () => {
  test("shows the slot as a blank the learner can see", () => {
    assert.equal(promptFor("I'd like {NP}, please.", "NP"), "I'd like ______, please.");
  });
});

describe("buildFrameDrill", () => {
  test("every option is a whole sentence, not just the filler", () => {
    const drill = buildFrameDrill(frame, "session-1")!;
    for (const o of drill.options) {
      assert.ok(o.sentence.includes(o.text), `${o.sentence} should contain ${o.text}`);
      assert.ok(!o.sentence.includes("{NP}"), "the slot must be filled");
    }
  });

  test(`offers at most ${MAX_FRAME_OPTIONS}, however many fillers exist`, () => {
    assert.equal(buildFrameDrill(frame, "s")!.options.length, MAX_FRAME_OPTIONS);
  });

  test("offers everything when there are fewer fillers than slots to show", () => {
    const small = { ...frame, fillers: frame.fillers.slice(0, 3) };
    assert.equal(buildFrameDrill(small, "s")!.options.length, 3);
  });

  test("never repeats a filler", () => {
    for (const seed of ["a", "b", "c", "session-42", "zzz"]) {
      const keys = buildFrameDrill(frame, seed)!.options.map((o) => o.key);
      assert.equal(new Set(keys).size, keys.length, `repeat at seed ${seed}`);
    }
  });

  test("is stable for one seed -- a re-render must not move the buttons", () => {
    const a = buildFrameDrill(frame, "session-7")!;
    const b = buildFrameDrill(frame, "session-7")!;
    assert.deepEqual(a.options, b.options);
  });

  test("a different session sees a different handful", () => {
    const seen = new Set(
      Array.from({ length: 12 }, (_, i) => buildFrameDrill(frame, `s${i}`)!.options[0].key),
    );
    assert.ok(seen.size > 1, "seeding on the session should vary which fillers come up");
  });

  test("capitalises when the slot opens the sentence", () => {
    const opener: SessionFrame = {
      ...frame,
      pattern: "{NP} is closed today.",
      esPattern: "{NP} está cerrado hoy.",
      fillers: [{ key: "c_1", text: "the bank" }, { key: "c_2", text: "the store" }],
    };
    const sentences = buildFrameDrill(opener, "s")!.options.map((o) => o.sentence);
    assert.ok(sentences.includes("The bank is closed today."));
  });

  test("returns null rather than an empty drill", () => {
    assert.equal(buildFrameDrill({ ...frame, fillers: [] }, "s"), null);
    assert.equal(buildFrameDrill({ ...frame, fillers: [{ key: "c_1", text: "  " }] }, "s"), null);
  });

  test("the Spanish pattern keeps its blank too", () => {
    assert.equal(buildFrameDrill(frame, "s")!.esPattern, "Me gustaría ______, por favor.");
  });
});
