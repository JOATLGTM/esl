import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import type { Voice } from "./audio-plan";

/**
 * TTS providers — all free, all local, none of them billed per token.
 *
 * Audio is generated ONCE at build time on a developer machine and committed as
 * static files. At runtime the app just plays a file: no API, no key, no
 * per-request cost, and it works offline. That is the whole point of doing this
 * at build time rather than calling a hosted TTS from the client.
 *
 * The interface is deliberately tiny — text in, audio bytes out — so the
 * week-1 HVPT spike can swap engines, or fall back to human recordings, without
 * touching the plan or the encoder.
 */

export type SynthResult = { bytes: Buffer; sourceFormat: "mp3" | "wav" | "ogg" | "aiff" };

export type TtsProvider = {
  name: string;
  /** Rough seconds of CPU per clip, for the dry-run estimate. Nothing costs money. */
  secondsPerClip: number;
  /** True if this engine only exists on the machine that has it installed. */
  local: true;
  synth(text: string, voice: Voice): Promise<SynthResult>;
};

function requireVoiceId(voice: Voice, provider: string): string {
  const id = voice.provider_voice?.[provider];
  if (!id) {
    throw new Error(
      `voices.yaml: voice "${voice.id}" has no ${provider} voice. ` +
        `Add one under provider_voice, or drop the voice from the roles that use it.`
    );
  }
  return id;
}

function run(cmd: string, args: string[], input?: Buffer) {
  const r = spawnSync(cmd, args, { input, maxBuffer: 1 << 28 });
  if (r.error) {
    const hint = (r.error as NodeJS.ErrnoException).code === "ENOENT" ? ` — is "${cmd}" installed and on PATH?` : "";
    throw new Error(`${cmd} failed: ${r.error.message}${hint}`);
  }
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}: ${r.stderr?.toString().trim()}`);
  return r;
}

function tempFile(ext: string): string {
  return path.join(os.tmpdir(), `hablar-tts-${crypto.randomBytes(8).toString("hex")}.${ext}`);
}

/**
 * macOS `say`. Ships with the OS, no install, no download, ~40 English voices
 * across US / UK / IN / AU / IE / ZA — which is enough talker variety to make
 * HVPT actually work (PRD F3), and enough accents to satisfy PRD 4.4's
 * requirement for at least one non-native-but-intelligible speaker.
 *
 * macOS-only, so it is the authoring machine's engine, not CI's.
 */
export const macosProvider: TtsProvider = {
  name: "macos",
  secondsPerClip: 0.25,
  local: true,
  async synth(text, voice) {
    const voiceName = requireVoiceId(voice, "macos");
    const out = tempFile("aiff");
    try {
      // `say` refuses to read from stdin reliably; a temp file keeps quoting
      // and non-ASCII safe.
      run("say", ["-v", voiceName, "-r", String(voice.rate_wpm ?? 175), "-o", out, "--", text]);
      return { bytes: fs.readFileSync(out), sourceFormat: "aiff" };
    } finally {
      fs.rmSync(out, { force: true });
    }
  },
};

/**
 * Piper — free, offline, MIT-licensed neural TTS. Noticeably better than `say`
 * and it runs on Linux, so it is the engine for CI and for anyone not on a Mac.
 *
 *   pip install piper-tts
 *   python -m piper.download_voices en_US-lessac-medium   # etc, once per voice
 *
 * NOT exercised by this repo's tests — nothing here installs Piper for you. If
 * you switch to it, generate one contrast set and listen before generating the
 * whole track.
 */
export const piperProvider: TtsProvider = {
  name: "piper",
  secondsPerClip: 0.4,
  local: true,
  async synth(text, voice) {
    const model = requireVoiceId(voice, "piper");
    const out = tempFile("wav");
    try {
      const bin = process.env.PIPER_BIN ?? "piper";
      const args = ["--model", model, "--output_file", out];
      if (process.env.PIPER_DATA_DIR) args.push("--data-dir", process.env.PIPER_DATA_DIR, "--download-dir", process.env.PIPER_DATA_DIR);
      run(bin, args, Buffer.from(text, "utf8"));
      return { bytes: fs.readFileSync(out), sourceFormat: "wav" };
    } finally {
      fs.rmSync(out, { force: true });
    }
  },
};

/**
 * Correctly-encoded silence at a plausible duration.
 *
 * Not a toy: it lets the whole skeleton run in CI and on any machine with no
 * TTS engine at all, and it makes the stitching and timing logic testable
 * without generating a single second of speech.
 */
export const silentProvider: TtsProvider = {
  name: "silent",
  secondsPerClip: 0.05,
  local: true,
  async synth(text) {
    const words = text.split(/\s+/).filter(Boolean).length;
    const seconds = Math.max(0.6, words / 2.6 + 0.35);
    const r = run("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-f", "lavfi",
      "-i", "anullsrc=r=24000:cl=mono", "-t", seconds.toFixed(2), "-f", "wav", "pipe:1",
    ]);
    return { bytes: r.stdout, sourceFormat: "wav" };
  },
};

export const PROVIDERS: Record<string, TtsProvider> = {
  macos: macosProvider,
  piper: piperProvider,
  silent: silentProvider,
};

export function resolveProvider(name: string): TtsProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(`unknown TTS provider "${name}". Known: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return provider;
}
