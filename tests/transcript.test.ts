import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { activeLineAt } from "../lib/session/transcript";

/** The real timings from b1_u1 scene 2 -- note the ~400ms gap between lines. */
const lines = [
  { startMs: 0, endMs: 1316 },
  { startMs: 1736, endMs: 4332 },
  { startMs: 4752, endMs: 8021 },
  { startMs: 8441, endMs: 10766 },
];

describe("which transcript line is playing", () => {
  test("finds the line covering the moment", () => {
    assert.equal(activeLineAt(lines, 0), 0);
    assert.equal(activeLineAt(lines, 900), 0);
    assert.equal(activeLineAt(lines, 2000), 1);
    assert.equal(activeLineAt(lines, 9000), 3);
  });

  test("highlights nothing in the silence between lines", () => {
    // The previous line lingering through the gap makes the highlight look
    // like it is running late, which is worse than it briefly going out.
    assert.equal(activeLineAt(lines, 1500), -1);
    assert.equal(activeLineAt(lines, 4500), -1);
  });

  test("is exclusive at the end and inclusive at the start", () => {
    assert.equal(activeLineAt(lines, 1316), -1);
    assert.equal(activeLineAt(lines, 1736), 1);
  });

  test("highlights nothing before playback starts", () => {
    // `null` is "not playing". Without it, a paused scene sits at 0ms, which is
    // inside line one, and the scene looks like it is already running.
    assert.equal(activeLineAt(lines, null), -1);
  });

  test("highlights nothing past the end", () => {
    assert.equal(activeLineAt(lines, 60_000), -1);
  });
});
