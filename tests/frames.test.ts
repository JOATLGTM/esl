import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { FrameSchema, UnitSchema, expandFrame, slotsIn, MIN_FRAME_FILLERS } from "../lib/content/types";
import { unitFrameWords, unitTaughtWords } from "../lib/content/load";

/**
 * Frames are the layer that lets the course produce sentences it never
 * authored, so the schema is the only thing standing between a pattern and a
 * card the learner cannot fill. These tests are the argument that it holds.
 */

const ok = {
  id: "f_0001",
  pattern: "I'd like {NP}, please.",
  es_pattern: "Me gustaría {NP}, por favor.",
  slot: "NP",
  fillers: ["c_0412", "c_0418", "c_0433"],
  cefr: "A1",
};

/** Zod issue messages for a value, or [] if it parsed. */
function issues(value: unknown): string[] {
  const r = FrameSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("frame schema", () => {
  test("accepts a well-formed frame", () => {
    assert.equal(FrameSchema.safeParse(ok).success, true);
  });

  test("the Spanish pattern keeps its slot -- the learner sees the shape, not an example", () => {
    const flat = issues({ ...ok, es_pattern: "Me gustaría un café, por favor." });
    assert.ok(flat.some((m) => m.includes("no {NP} placeholder")));
  });

  test("both patterns use the same slot name -- {SN} for {NP} is a mismatch, not a translation", () => {
    assert.ok(
      issues({ ...ok, es_pattern: "Me gustaría {SN}, por favor." }).some((m) => m.includes("{SN}")),
    );
  });

  test("rejects a pattern with no slot at all", () => {
    assert.ok(issues({ ...ok, pattern: "I'd like a coffee, please." }).length > 0);
  });

  test("rejects two slots -- a frame has exactly one hole", () => {
    assert.ok(
      issues({ ...ok, pattern: "I'd like {NP} and {NP}." }).some((m) => m.includes("exactly one slot")),
    );
  });

  test("rejects a slot the frame did not declare", () => {
    assert.ok(
      issues({ ...ok, pattern: "I'd like {THING}, please." }).some((m) => m.includes("{THING}")),
    );
  });

  test(`rejects fewer than ${MIN_FRAME_FILLERS} fillers`, () => {
    assert.ok(issues({ ...ok, fillers: ["c_0412", "c_0418"] }).length > 0);
  });

  test("rejects duplicate fillers -- the same option twice is not a choice", () => {
    assert.ok(
      issues({ ...ok, fillers: ["c_0412", "c_0412", "c_0418"] }).some((m) => m.includes("duplicate")),
    );
  });

  test("fillers are chunk ids, never free text", () => {
    assert.ok(issues({ ...ok, fillers: ["a coffee", "a tea", "water"] }).length > 0);
  });
});

describe("expandFrame", () => {
  test("substitutes mid-sentence", () => {
    assert.equal(expandFrame("I'd like {NP}, please.", "NP", "a coffee"), "I'd like a coffee, please.");
  });

  test("capitalises when the slot opens the sentence", () => {
    assert.equal(expandFrame("{NP} is closed today.", "NP", "the bank"), "The bank is closed today.");
  });

  test("leaves an already-capitalised filler alone", () => {
    assert.equal(expandFrame("{NP} is here.", "NP", "Ana"), "Ana is here.");
  });

  test("slotsIn finds every placeholder", () => {
    assert.deepEqual(slotsIn("{A} and {B} and {A}"), ["A", "B", "A"]);
    assert.deepEqual(slotsIn("no slots here"), []);
  });
});

describe("frames and the known-word timeline", () => {
  const unit = UnitSchema.parse({
    unit_id: "b1_u1",
    block: 1,
    order: 1,
    title_es: "t",
    title_en: "t",
    cefr: "A0",
    can_do_es: "c",
    target_contrast: "ee_ih",
    chunks: [{
      id: "c_0001", en: "a coffee", es: "un café", cefr: "A0",
      example_en: "A coffee, please.", example_es: "Un café, por favor.", audio: ["auto"],
    }],
    frames: [{ ...ok, fillers: ["c_0001", "c_0002", "c_0003"] }],
    scenes: [{
      id: "s_0001", title_es: "t", character: "ana", duration_target_s: 40,
      transcript: "ANA: Hello.\nMIGUEL: Hi.",
      questions: Array.from({ length: 3 }, () => ({ q_es: "q", options_es: ["a", "b"], answer: 0 })),
    }],
    speaking_task: {
      mode: "scripted", character: "ana", scenario_es: "s", scenario_en: "s",
      target_chunks: ["c_0001"],
      script: [{ speaker: "user", en: "Hello." }],
    },
  });

  test("a frame's literal words are taught", () => {
    const words = unitFrameWords(unit);
    assert.ok(words.has("would"), "I'd expands to I + would");
    assert.ok(words.has("like"));
    assert.ok(words.has("please"));
  });

  test("the slot never enters the known set as a word", () => {
    assert.equal(unitFrameWords(unit).has("np"), false);
  });

  test("frame words reach the cumulative timeline via unitTaughtWords", () => {
    assert.ok(unitTaughtWords(unit).has("please"));
  });

  test("fillers contribute nothing here -- they are taught where they live", () => {
    // c_0002 and c_0003 are referenced but defined in some other unit; the
    // frame must not credit the learner for words on a cross-reference.
    assert.equal(unitFrameWords(unit).has("tea"), false);
  });

  test("a unit with no frames is still valid content", () => {
    const noFrames: Record<string, unknown> = { ...unit };
    delete noFrames.frames;
    assert.equal(UnitSchema.safeParse(noFrames).success, true);
    assert.deepEqual(UnitSchema.parse(noFrames).frames, []);
  });
});
