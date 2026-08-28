import assert from "node:assert/strict";
import { test, describe } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * A landmine test.
 *
 * `produce_spoken` is a legal review mode, `countsAsProduction` returns true
 * for it, and `learned` requires two production passes -- enforced by the
 * `learned_requires_production` CHECK, because it is the most load-bearing
 * pedagogical rule in the product. Nothing emits `produce_spoken`.
 *
 * That looks like a gap and is currently a load-bearing absence. Speaking in
 * this product is **self-reported**: there is no pronunciation score and no
 * pass mark, by design (PRD 4.5), because anything that makes a beginner
 * afraid to open their mouth costs more than it measures. So a learner tapping
 * "Ya lo dije" twice is not evidence they can say the phrase -- and if that tap
 * ever writes a `produce_spoken` review, two taps mature a card to `learned`
 * and the mastery rule becomes a button.
 *
 * The mode itself is right and should stay: a *verified* spoken pass belongs in
 * `countsAsProduction`, and on-device recognition could make one possible
 * without breaking the $0 rule. What must not happen is a self-report wearing
 * its clothes. Speaking is recorded where it cannot inflate mastery:
 * `sessions.speaking_tasks_completed`, written server-side.
 *
 * So the invariant is about who may *say* the word, not whether the word is
 * allowed to exist.
 */

const ROOT = path.join(import.meta.dirname, "..");

/**
 * The only places `produce_spoken` may appear.
 *
 * - `actions.ts` accepts it in the payload schema. Accepting is not emitting;
 *   the enum mirrors the database type.
 * - `grade.ts` decides what it would mean if one ever arrived.
 * - `database.types.ts` is generated from the enum and never hand-edited.
 */
const ALLOWED = new Set([
  "app/session/actions.ts",
  "lib/session/grade.ts",
  "lib/supabase/database.types.ts",
]);

function sourceFiles(dir: string): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(p);
    }
  };
  walk(full);
  return out;
}

describe("self-reported speech never matures a card", () => {
  test("no new file emits produce_spoken", () => {
    const offenders: string[] = [];
    for (const dir of ["app", "lib", "components"]) {
      for (const file of sourceFiles(dir)) {
        const rel = path.relative(ROOT, file);
        if (ALLOWED.has(rel)) continue;
        if (fs.readFileSync(file, "utf8").includes("produce_spoken")) offenders.push(rel);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `${offenders.join(", ")} references produce_spoken.\n\n` +
        "Speaking in this product is self-reported -- there is no pass mark, by " +
        "design. A review in this mode counts toward `learned` (two passes, and " +
        "the database enforces it), so emitting one from a tap turns the mastery " +
        "rule into a button. Record speaking in sessions.speaking_tasks_completed " +
        "instead, and see the comment at the top of this file.",
    );
  });

  test("the Speak stage records speaking without writing a review", () => {
    const speak = fs.readFileSync(path.join(ROOT, "lib/session/speak.ts"), "utf8");
    assert.ok(
      speak.includes("speaking_tasks_completed"),
      "speaking has to be counted somewhere, or the product's headline metric is unmeasured",
    );
    assert.ok(!speak.includes("reviewCard"), "the Speak stage must not write card reviews");
  });
});
