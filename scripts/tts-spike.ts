#!/usr/bin/env -S npx tsx
/**
 * The week-1 TTS spike (PRD 10, Phase 1).
 *
 *   npm run content:spike
 *   npm run content:spike -- --providers=macos,piper
 *
 * The PRD makes this a decision, not an assumption: generate twenty real lines
 * in every engine and voice on the machine, listen critically, and decide
 * whether the audio is good enough to carry six blocks of listening practice
 * BEFORE authoring them. Discovering the answer in month three means rewriting
 * the content strategy with 500 scenes already built.
 *
 * Writes to public/audio/.spike/<provider>/<voice>/NN.opus plus an index.md,
 * and touches nothing the real pipeline owns.
 *
 * What to listen for, in order:
 *   1. Are the cast voices actually DIFFERENT people? (the pipeline checks this
 *      mechanically, but trust your ear over the hash)
 *   2. Are names and places right? Miguel, Maria, Colombia — the espeak-ng
 *      phonemiser guesses, and a learner learns the guess.
 *   3. Does a 45-second scene get tiring? That is the one that kills the
 *      product, and it does not show up in a five-second sample.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { AUDIO_FORMAT } from "../lib/content/audio-plan";
import { loadContent, loadPronunciationOverrides, loadVoiceRoster } from "../lib/content/load";
import { PROVIDERS, resolveProvider } from "../lib/content/tts-providers";

const OUT = path.join(process.cwd(), "public", "audio", ".spike");
const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

/** Real lines from real content, not "the quick brown fox". */
function spikeLines(): string[] {
  const bundle = loadContent();
  const lines: string[] = [];
  for (const unit of bundle.units) {
    for (const scene of unit.scenes) {
      for (const raw of scene.transcript.split("\n")) {
        const text = raw.replace(/^\s*[A-Za-z][A-Za-z0-9_]*\s*:\s*/, "").trim();
        if (text && !lines.includes(text)) lines.push(text);
      }
    }
    for (const chunk of unit.chunks) {
      if (!lines.includes(chunk.example_en)) lines.push(chunk.example_en);
    }
  }
  // Weighted toward the awkward ones: anything with a name or a place in it,
  // because that is where the phonemiser fails and where it matters most.
  const risky = lines.filter((l) => /Miguel|Maria|Ana|Rosa|Carlos|Tom|Mexico|Colombia|Peru|Chile|Texas|England/.test(l));
  const plain = lines.filter((l) => !risky.includes(l));
  return [...risky.slice(0, 12), ...plain.slice(0, 8)];
}

function encode(input: Buffer, outFile: string) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", "pipe:0",
     "-c:a", AUDIO_FORMAT.codec, "-b:a", AUDIO_FORMAT.bitrate, "-ac", "1", "-vn", outFile],
    { input, maxBuffer: 1 << 28 }
  );
  if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr.toString().trim()}`);
}

async function main() {
  const roster = loadVoiceRoster();
  const spell = loadPronunciationOverrides();
  const names = (opt("providers") ?? Object.keys(PROVIDERS).filter((p) => p !== "silent").join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = spikeLines();

  fs.rmSync(OUT, { recursive: true, force: true });
  console.log(`\n  TTS spike — ${lines.length} lines x ${roster.voices.length} voices x ${names.length} engine(s)\n`);

  const index: string[] = [
    "# TTS spike (PRD 10, Phase 1 week 1)",
    "",
    "Listen before authoring Block 2. The go/no-go question is not \"is this",
    "impressive\" — it is \"could I listen to 45 seconds of this every day for a",
    "year without switching off\".",
    "",
  ];
  const failures: string[] = [];

  for (const name of names) {
    let provider;
    try {
      provider = resolveProvider(name);
    } catch (e) {
      failures.push(`${name}: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    index.push(`## ${name}`, "");
    for (const voice of roster.voices) {
      const engineVoice = voice.provider_voice[name];
      if (!engineVoice) {
        index.push(`- \`${voice.id}\` — no ${name} voice configured, skipped`);
        continue;
      }
      let generated = 0;
      for (const [i, line] of lines.entries()) {
        const outFile = path.join(OUT, name, voice.id, `${String(i + 1).padStart(2, "0")}.${AUDIO_FORMAT.ext}`);
        try {
          const { bytes } = await provider.synth(spell(line, name), voice);
          encode(bytes, outFile);
          generated++;
        } catch (e) {
          failures.push(`${name}/${voice.id}: ${e instanceof Error ? e.message : e}`);
          break;
        }
      }
      if (generated) {
        console.log(`    ${name.padEnd(8)} ${voice.id.padEnd(10)} "${engineVoice}"  ${generated} lines`);
        index.push(`- \`${voice.id}\` (“${engineVoice}”, ${voice.accent}) — \`${name}/${voice.id}/\``);
      }
    }
    index.push("");
  }

  index.push("## The lines", "");
  lines.forEach((l, i) => index.push(`${String(i + 1).padStart(2, "0")}. ${l}`));
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "index.md"), index.join("\n") + "\n");

  if (failures.length) {
    console.log(`\n  ${failures.length} engine/voice combination(s) unavailable:`);
    for (const f of failures.slice(0, 8)) console.log(`    - ${f}`);
    if (names.includes("piper")) {
      console.log(`\n    Piper is the engine the PRD prescribes (8.1A). To install it:`);
      console.log(`      pip install piper-tts`);
      console.log(`      python -m piper.download_voices en_US-amy-medium   # once per voice`);
    }
  }

  console.log(`\n  ✓ ${path.relative(process.cwd(), OUT)}/index.md`);
  console.log(`    This directory is scratch and is not committed. Delete it when you have decided.\n`);
}

main().catch((e) => {
  console.error(`\n  ✗ ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
