import assert from "node:assert/strict";
import { test, describe } from "node:test";
import fs from "node:fs";
import path from "node:path";

/**
 * The premise test (PRD 8.1E).
 *
 * The entire product design rests on one claim: no paid API, at runtime or at
 * build time. Infrastructure cost per active user per month is a stated success
 * metric (< $0.05) and every architectural compromise in the PRD -- pre-authored
 * dialogue trees instead of an LLM partner, static Opus instead of hosted TTS,
 * rule-based error detection -- was accepted to keep it true.
 *
 * A claim like that decays silently. One `fetch` to an inference endpoint added
 * in a hurry does not break a test, does not fail a type check, and does not
 * show up in review as anything other than a feature. So it gets its own test,
 * and the test fails the build.
 */

const ROOT = path.join(import.meta.dirname, "..");

/**
 * Hosts that bill per call. Not exhaustive and cannot be -- the point is to
 * catch the obvious ones loudly enough that the non-obvious one gets a
 * conversation instead of a commit.
 */
const PAID_HOSTS = [
  "api.anthropic.com",
  "api.openai.com",
  "api.groq.com",
  "api.mistral.ai",
  "api.cohere.ai",
  "generativelanguage.googleapis.com",
  "api.elevenlabs.io",
  "api.play.ht",
  "api.deepgram.com",
  "api.assemblyai.com",
  "speech.googleapis.com",
  "texttospeech.googleapis.com",
  "cognitiveservices.azure.com",
  "polly.amazonaws.com",
  "transcribe.amazonaws.com",
  "api-inference.huggingface.co",
  "api.replicate.com",
  "openrouter.ai",
];

/** Packages that only exist to call a metered service. */
const PAID_PACKAGES = [
  "@anthropic-ai/sdk",
  "openai",
  "@google/generative-ai",
  "@google-cloud/text-to-speech",
  "@google-cloud/speech",
  "elevenlabs",
  "@aws-sdk/client-polly",
  "microsoft-cognitiveservices-speech-sdk",
  "cohere-ai",
  "replicate",
  "groq-sdk",
];

function sourceFiles(dir: string): string[] {
  const full = path.join(ROOT, dir);
  if (!fs.existsSync(full)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) out.push(p);
    }
  };
  walk(full);
  return out;
}

/** Everything that can end up in front of a user. */
const RUNTIME_DIRS = ["app", "lib", "components"];

describe("zero paid APIs (PRD 8.1E)", () => {
  test("no runtime file references a metered API host", () => {
    const offenders: string[] = [];
    for (const dir of RUNTIME_DIRS) {
      for (const file of sourceFiles(dir)) {
        const text = fs.readFileSync(file, "utf8");
        for (const host of PAID_HOSTS) {
          // A mention inside a comment is how this file itself documents the
          // rule, so only flag hosts that appear in a string or a URL.
          const inCode = new RegExp(`["'\`][^"'\`\\n]*${host.replace(/\./g, "\\.")}`).test(text);
          if (inCode) offenders.push(`${path.relative(ROOT, file)} -> ${host}`);
        }
      }
    }
    assert.deepEqual(
      offenders,
      [],
      `runtime code reaches a paid service:\n  ${offenders.join("\n  ")}\n` +
        `The product's economics assume this never happens (PRD 8.1, PRD 3).`
    );
  });

  test("no paid-service SDK is a dependency", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {}),
    ]);
    const found = PAID_PACKAGES.filter((p) => declared.has(p));
    assert.deepEqual(found, [], `metered-service SDKs in package.json: ${found.join(", ")}`);
  });

  test("build-time and privileged modules never reach the client bundle", () => {
    // Three things must not be importable from rendered code:
    //
    //   tts-providers   spawns local processes; in a browser bundle it is at
    //                   best dead weight and at worst an unexplainable build error
    //   scripts/        build-time tooling, same reason
    //   supabase/admin  the service-role client, which bypasses row-level
    //                   security entirely. It cannot use the `server-only`
    //                   package (that would break the seed script, which is its
    //                   one legitimate caller), so this test is that guard.
    const offenders: string[] = [];
    for (const dir of ["app", "components"]) {
      for (const file of sourceFiles(dir)) {
        const text = fs.readFileSync(file, "utf8");
        if (/from\s+["'][^"']*(tts-providers|scripts\/|supabase\/admin)/.test(text)) {
          offenders.push(path.relative(ROOT, file));
        }
      }
    }
    assert.deepEqual(offenders, [], `client code importing privileged modules: ${offenders.join(", ")}`);
  });

  test("ear-training audio is never synthesised (PRD 8.1B)", () => {
    // The roster schema refuses an `hvpt` role, and the plan has no code path
    // that could produce one -- but this is the rule most likely to be
    // "temporarily" relaxed when volunteers are slow, so it gets a test that
    // names the reason.
    const roster = fs.readFileSync(path.join(ROOT, "content", "voices.yaml"), "utf8");
    const roles = roster.slice(roster.indexOf("\nroles:"));
    assert.ok(
      !/^\s+hvpt\s*:/m.test(roles),
      "voices.yaml defines an `hvpt` role. Minimal-pair audio must come from real " +
        "speakers (content/speakers.yaml): high-variability training works because " +
        "the talkers genuinely vary, and TTS voices do not vary enough to teach it."
    );
  });
});
