#!/usr/bin/env -S npx tsx
/**
 * Audio pipeline (PRD F9 / §8.1).
 *
 *   npm run content:audio -- --dry-run           # what it would do
 *   npm run content:audio -- --provider=silent   # offline placeholders
 *   npm run content:audio                        # real voices
 *
 * Nothing here costs money. Every engine is local, audio is generated once on a
 * developer machine and committed as static files, and the running product just
 * plays a file: no API, no key, no per-user cost, and it works offline.
 *
 * Idempotent by content hash: a clip is regenerated only if its text, voice, or
 * encoding changed. Re-running after editing one chunk costs one clip.
 *
 * Two kinds of audio, and they are NOT interchangeable (PRD §8.1):
 *   - scripted content is synthesised here;
 *   - ear-training minimal pairs are human recordings, ingested from
 *     content/recordings/, never synthesised. See §8.1B for why.
 *
 * DEVIATION FROM THE PRD, on purpose: the PRD says "writes back URLs" into the
 * YAML. Rewriting 25 chunks x 4 voices inline would bury the authored content
 * under generated noise and fight every hand-written comment in the file, so
 * URLs land in content/audio-manifest.json instead and the YAML keeps saying
 * `audio: [auto]`. The manifest is what the app resolves against; the effect is
 * the same and the content files stay readable.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  AUDIO_FORMAT,
  AUDIO_PIPELINE_VERSION,
  buildAudioPlan,
  loadVoiceRoster,
  type AudioPlan,
  type ClipSpec,
  type ScenePlan,
} from "../lib/content/audio-plan";
import { loadContent } from "../lib/content/load";
import { resolveProvider, type TtsProvider } from "../lib/content/tts-providers";

const OUT_DIR = path.join(process.cwd(), "public", "audio");
const MANIFEST = path.join(process.cwd(), "content", "audio-manifest.json");
/** Silence between scene lines, so a dialogue does not sound like one breath. */
const SCENE_GAP_MS = 420;
const CONCURRENCY = 6;

type ManifestClip = {
  url: string;
  kind: string;
  text: string;
  voiceId: string;
  ownerId: string;
  unitId?: string;
  durationMs: number;
  bytes: number;
};

/** A human-read minimal-pair word (PRD 8.1B). Not generated -- ingested. */
type ManifestRecording = {
  url: string;
  contrast: string;
  pairId: string;
  word: string;
  speakerId: string;
  durationMs: number;
  bytes: number;
};

type ManifestScene = {
  url: string;
  unitId: string;
  durationMs: number;
  bytes: number;
  /** Sentence-level seek (PRD F4 acceptance criteria). */
  segments: { start_ms: number; end_ms: number; character: string; en: string }[];
};

type Manifest = {
  version: number;
  provider: string;
  format: typeof AUDIO_FORMAT;
  clips: Record<string, ManifestClip>;
  scenes: Record<string, ManifestScene>;
  recordings: Record<string, ManifestRecording>;
  /** Decoded-audio digest per voice -- proof that no two voices are the same. */
  voiceProbes: Record<string, string>;
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

function ffprobeDurationMs(file: string): number {
  const r = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]);
  if (r.status !== 0) throw new Error(`ffprobe failed on ${file}: ${r.stderr.toString().trim()}`);
  return Math.round(parseFloat(r.stdout.toString().trim()) * 1000);
}

/** Everything lands as Opus 32kbps mono, whatever the provider handed back. */
function encodeToOpus(input: Buffer, outFile: string) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const r = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-y", "-i", "pipe:0",
     "-c:a", AUDIO_FORMAT.codec, "-b:a", AUDIO_FORMAT.bitrate,
     "-ac", String(AUDIO_FORMAT.channels), "-vn", outFile],
    { input, maxBuffer: 1 << 28 }
  );
  if (r.status !== 0) throw new Error(`ffmpeg encode failed: ${r.stderr.toString().trim()}`);
}

/** Stitch a scene's lines into one track, recording where each line starts. */
function stitchScene(scene: ScenePlan, clips: Map<string, ManifestClip>, outFile: string) {
  const parts = scene.lines.map((l) => {
    const clip = clips.get(l.clipHash);
    if (!clip) throw new Error(`${scene.sceneId}: line ${l.index} has no generated clip`);
    return { line: l, clip, file: path.join(OUT_DIR, clip.url.replace(/^\/audio\//, "")) };
  });

  const listFile = path.join(OUT_DIR, `.${scene.trackHash}.concat.txt`);
  const silence = path.join(OUT_DIR, `.gap-${SCENE_GAP_MS}.${AUDIO_FORMAT.ext}`);
  if (!fs.existsSync(silence)) {
    const r = spawnSync("ffmpeg", [
      "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi",
      "-i", "anullsrc=r=48000:cl=mono", "-t", (SCENE_GAP_MS / 1000).toFixed(3),
      "-c:a", AUDIO_FORMAT.codec, "-b:a", AUDIO_FORMAT.bitrate, "-ac", "1", silence,
    ]);
    if (r.status !== 0) throw new Error(`ffmpeg failed generating scene gap: ${r.stderr.toString().trim()}`);
  }

  const entries: string[] = [];
  const segments: ManifestScene["segments"] = [];
  let cursor = 0;
  for (const [i, part] of parts.entries()) {
    if (i > 0) {
      entries.push(`file '${silence}'`);
      cursor += SCENE_GAP_MS;
    }
    entries.push(`file '${part.file}'`);
    segments.push({
      start_ms: cursor,
      end_ms: cursor + part.clip.durationMs,
      character: part.line.character,
      en: part.line.text,
    });
    cursor += part.clip.durationMs;
  }

  fs.writeFileSync(listFile, entries.join("\n"));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const r = spawnSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-f", "concat", "-safe", "0",
    "-i", listFile, "-c:a", AUDIO_FORMAT.codec, "-b:a", AUDIO_FORMAT.bitrate, "-ac", "1", outFile,
  ]);
  fs.unlinkSync(listFile);
  if (r.status !== 0) throw new Error(`ffmpeg concat failed for ${scene.sceneId}: ${r.stderr.toString().trim()}`);

  return segments;
}

/**
 * Digest of the DECODED audio, not the file.
 *
 * Ogg randomises its stream serial number per file, so two byte-different files
 * routinely hold identical audio. Comparing the PCM is the only comparison that
 * answers the question we actually care about: is this the same voice?
 */
function waveformDigest(file: string): string {
  const r = spawnSync("ffmpeg", [
    "-v", "error", "-i", file, "-f", "s16le", "-ac", "1", "-ar", "24000", "pipe:1",
  ], { maxBuffer: 1 << 28 });
  if (r.status !== 0) throw new Error(`ffmpeg decode failed on ${file}: ${r.stderr.toString().trim()}`);
  return crypto.createHash("sha256").update(r.stdout).digest("hex").slice(0, 16);
}

/**
 * Prove every voice in the roster is a DIFFERENT voice before generating a
 * track with it (PRD 8.1A, and the reason voices.yaml carries `probe_text`).
 *
 * This exists because Block 1 shipped without it. macOS `say` silently falls
 * back to the system default when a named voice is not downloaded -- no error,
 * no warning, plausible output -- so us_f_1, us_m_1 and uk_f_1 were three names
 * for Samantha. Every "conversation" was one talker playing all the parts, and
 * the HVPT drill's no-two-consecutive-speakers rule (PRD F3) was satisfied on
 * paper and violated in the ear.
 *
 * A duplicated voice is invisible in code review and obvious the moment you
 * listen. So: listen, in software, every run.
 */
async function probeVoices(plan: AudioPlan, provider: TtsProvider): Promise<Record<string, string>> {
  const probeDir = path.join(OUT_DIR, ".probe");
  fs.mkdirSync(probeDir, { recursive: true });
  const digests: Record<string, string> = {};
  const collisions = new Map<string, string[]>();

  for (const voice of plan.roster.voices) {
    if (!voice.provider_voice[provider.name]) {
      throw new Error(
        `voices.yaml: voice "${voice.id}" has no ${provider.name} voice. Add one under ` +
          `provider_voice, or drop the voice from the roles that use it.`
      );
    }
    const file = path.join(probeDir, `${voice.id}.${AUDIO_FORMAT.ext}`);
    const { bytes } = await provider.synth(plan.probeText, voice);
    encodeToOpus(bytes, file);
    const digest = waveformDigest(file);
    digests[voice.id] = digest;
    if (!collisions.has(digest)) collisions.set(digest, []);
    collisions.get(digest)!.push(voice.id);
  }
  fs.rmSync(probeDir, { recursive: true, force: true });

  const duplicated = [...collisions.values()].filter((ids) => ids.length > 1);
  if (duplicated.length) {
    const lines = duplicated.map((ids) => {
      const named = ids.map((id) => {
        const v = plan.roster.voices.find((x) => x.id === id)!;
        return `${id} ("${v.provider_voice[provider.name]}")`;
      });
      return `      ${named.join("  ==  ")}`;
    });
    throw new Error(
      `these voices produce identical audio -- "${provider.name}" is substituting a default:\n` +
        lines.join("\n") +
        `\n\n    They are one voice wearing several names. Scenes would be one talker\n` +
        `    playing every part, and ear training would have fewer real talkers than\n` +
        `    the drill scheduler thinks (PRD F3).\n\n` +
        (provider.name === "macos"
          ? `    Fix: install the missing voices in System Settings > Accessibility >\n` +
            `    Spoken Content > System Voice > Manage Voices, or point voices.yaml at\n` +
            `    voices that are actually present.\n`
          : `    Fix: check provider_voice ids in content/voices.yaml.\n`)
    );
  }
  return digests;
}

/**
 * Ingest human ear-training recordings (PRD 8.1B). These are read by real
 * people and are never synthesised; the pipeline only transcodes them into the
 * same Opus budget as everything else and registers them in the manifest.
 */
function ingestRecordings(plan: AudioPlan, manifest: Manifest, force: boolean) {
  const present = plan.recordings.filter((r) => r.present);
  let ingested = 0;
  for (const rec of present) {
    const outFile = path.join(OUT_DIR, rec.relPath);
    const cached = manifest.recordings[rec.hash];
    if (!force && cached && fs.existsSync(outFile)) continue;
    encodeToOpus(fs.readFileSync(rec.sourceFile), outFile);
    manifest.recordings[rec.hash] = {
      url: `/audio/${rec.relPath}`,
      contrast: rec.contrast,
      pairId: rec.pairId,
      word: rec.word,
      speakerId: rec.speakerId,
      durationMs: ffprobeDurationMs(outFile),
      bytes: fs.statSync(outFile).size,
    };
    ingested++;
  }
  return { ingested, present: present.length, missing: plan.recordings.length - present.length };
}

/**
 * Drop manifest entries for content that no longer exists.
 *
 * The manifest is loaded and *merged into*, so an edited transcript leaves its
 * old line behind forever: the entry is never overwritten, because the new line
 * hashes differently. That is not merely untidy. The stale entry claims its
 * file, so `pruneOrphans` treats the file as live and never deletes it; it
 * counts toward the per-unit download budget; and it is fed to the speech-rate
 * gate, where a deleted line goes on dragging a voice's average around.
 *
 * Found on 2026-08-28 while rebalancing `s_0010`: removing one of Carlos's
 * lines made the scene's speaker spread *worse*, because the removed line was
 * still being measured.
 *
 * Recordings are deliberately not pruned here. They are human-read files that
 * cost somebody an afternoon, and a contrast set being edited must never be a
 * reason to throw them away -- `pruneOrphans` handles their files separately.
 */
function pruneStaleEntries(manifest: Manifest, plan: AudioPlan): number {
  const liveClips = new Set(plan.clips.map((c) => c.hash));
  const liveScenes = new Set(plan.scenes.map((s) => s.sceneId));

  let removed = 0;
  for (const hash of Object.keys(manifest.clips)) {
    if (liveClips.has(hash)) continue;
    delete manifest.clips[hash];
    removed++;
  }
  for (const id of Object.keys(manifest.scenes)) {
    if (liveScenes.has(id)) continue;
    delete manifest.scenes[id];
    removed++;
  }
  return removed;
}

/** Delete generated files the current plan no longer references. */
function pruneOrphans(manifest: Manifest): number {
  if (!fs.existsSync(OUT_DIR)) return 0;
  const live = new Set<string>();
  for (const c of Object.values(manifest.clips)) live.add(c.url.replace(/^\/audio\//, ""));
  for (const s of Object.values(manifest.scenes)) live.add(s.url.replace(/^\/audio\//, ""));
  for (const r of Object.values(manifest.recordings)) live.add(r.url.replace(/^\/audio\//, ""));

  let removed = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
        continue;
      }
      const rel = path.relative(OUT_DIR, full);
      // Dotfiles are pipeline scratch (the scene gap, probe leftovers).
      if (path.basename(rel).startsWith(".")) continue;
      if (!live.has(rel)) {
        fs.rmSync(full);
        removed++;
      }
    }
  };
  walk(OUT_DIR);
  return removed;
}

function empty(providerName: string): Manifest {
  return {
    version: AUDIO_PIPELINE_VERSION,
    provider: providerName,
    format: AUDIO_FORMAT,
    clips: {},
    scenes: {},
    recordings: {},
    voiceProbes: {},
  };
}

function loadManifest(providerName: string): Manifest {
  if (!fs.existsSync(MANIFEST)) {
    return empty(providerName);
  }
  const existing = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest;
  // A provider switch means every synthesised clip is stale, hash or no hash.
  // Human recordings survive it: they were never tied to an engine.
  if (existing.provider !== providerName || existing.version !== AUDIO_PIPELINE_VERSION) {
    const fresh = empty(providerName);
    fresh.recordings = existing.recordings ?? {};
    return fresh;
  }
  existing.recordings ??= {};
  existing.voiceProbes ??= {};
  return existing;
}

async function runPool<T>(items: T[], limit: number, worker: (item: T, i: number) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}

function humanBytes(n: number): string {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const bundle = loadContent();
  const roster = loadVoiceRoster();
  const providerName = opt("provider") ?? roster.provider;
  const provider: TtsProvider = resolveProvider(providerName);
  const plan = buildAudioPlan(bundle, roster);
  const only = opt("only");
  const force = flag("force");

  const voices = new Map(roster.voices.map((v) => [v.id, v]));
  const manifest = loadManifest(providerName);

  let clips = plan.clips;
  if (only) clips = clips.filter((c) => c.kind === only);

  const todo = clips.filter((c) => {
    if (force) return true;
    const existing = manifest.clips[c.hash];
    return !existing || !fs.existsSync(path.join(OUT_DIR, existing.url.replace(/^\/audio\//, "")));
  });

  const chars = todo.reduce((n, c) => n + c.text.length, 0);
  // Every engine is local and free. The only budget worth reporting is time.
  const estSeconds = (todo.length * provider.secondsPerClip) / CONCURRENCY;
  const missingRecordings = plan.recordings.filter((r) => !r.present);

  console.log(`\n  Audio pipeline — provider "${providerName}" (local, free), ${AUDIO_FORMAT.bitrate} Opus mono`);
  console.log(`  ${plan.clips.length} clips planned, ${plan.scenes.length} scene tracks`);
  console.log(`  ${todo.length} to generate (${plan.clips.length - todo.length} cached), ${chars.toLocaleString()} chars`);
  console.log(`  estimated time: ~${estSeconds < 60 ? `${estSeconds.toFixed(0)}s` : `${(estSeconds / 60).toFixed(1)} min`}   cost: $0.00\n`);

  const byKind = new Map<string, number>();
  for (const c of todo) byKind.set(c.kind, (byKind.get(c.kind) ?? 0) + 1);
  for (const [kind, n] of byKind) console.log(`    ${kind.padEnd(12)} ${n}`);
  console.log(
    `    ${"hvpt (human)".padEnd(12)} ${plan.recordings.length - missingRecordings.length}/${plan.recordings.length} recorded` +
      (missingRecordings.length ? "  — not synthesised, see PRD 8.1B" : "")
  );

  if (flag("dry-run")) {
    console.log("\n  --dry-run: nothing generated.\n");
    return;
  }

  // Prove the voices are distinct BEFORE spending an hour generating a track
  // in which three of them are secretly the same voice.
  if (todo.length || force) {
    process.stdout.write(`    probing ${plan.roster.voices.length} voices for distinctness... `);
    manifest.voiceProbes = await probeVoices(plan, provider);
    console.log("all distinct");
  }

  let done = 0;
  const failures: { spec: ClipSpec; error: string }[] = [];

  await runPool(todo, CONCURRENCY, async (spec) => {
    const voice = voices.get(spec.voiceId)!;
    const outFile = path.join(OUT_DIR, spec.relPath);
    try {
      const { bytes } = await provider.synth(spec.synthText, voice);
      encodeToOpus(bytes, outFile);
      manifest.clips[spec.hash] = {
        url: `/audio/${spec.relPath}`,
        kind: spec.kind,
        text: spec.text,
        voiceId: spec.voiceId,
        ownerId: spec.ownerId,
        unitId: spec.unitId,
        durationMs: ffprobeDurationMs(outFile),
        bytes: fs.statSync(outFile).size,
      };
    } catch (e) {
      failures.push({ spec, error: e instanceof Error ? e.message : String(e) });
    }
    done++;
    if (done % 25 === 0 || done === todo.length) {
      process.stdout.write(`\r    generated ${done}/${todo.length}`);
    }
  });
  if (todo.length) process.stdout.write("\n");

  // Scenes are stitched from line clips, so they can only run once every line
  // in the scene exists.
  const clipIndex = new Map(Object.entries(manifest.clips));
  let stitched = 0;
  for (const scene of plan.scenes) {
    if (only && only !== "scene") continue;
    const outFile = path.join(OUT_DIR, scene.relPath);
    const cached = manifest.scenes[scene.sceneId];
    if (!force && cached?.url === `/audio/${scene.relPath}` && fs.existsSync(outFile)) continue;
    if (!scene.lines.every((l) => clipIndex.has(l.clipHash))) continue;
    try {
      const segments = stitchScene(scene, clipIndex, outFile);
      manifest.scenes[scene.sceneId] = {
        url: `/audio/${scene.relPath}`,
        unitId: scene.unitId,
        durationMs: ffprobeDurationMs(outFile),
        bytes: fs.statSync(outFile).size,
        segments,
      };
      stitched++;
    } catch (e) {
      failures.push({
        spec: {
          hash: scene.trackHash,
          kind: "scene_line",
          text: scene.sceneId,
          synthText: scene.sceneId,
          voiceId: "-",
          ownerId: scene.sceneId,
          relPath: scene.relPath,
        },
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  if (stitched) console.log(`    stitched ${stitched} scene track(s)`);

  const rec = ingestRecordings(plan, manifest, force);
  if (rec.ingested) console.log(`    ingested ${rec.ingested} human recording(s)`);

  // Order matters: stale entries must go first, or they keep their files alive.
  const stale = pruneStaleEntries(manifest, plan);
  if (stale) console.log(`    dropped ${stale} stale manifest entr(ies)`);

  const pruned = pruneOrphans(manifest);
  if (pruned) console.log(`    pruned ${pruned} orphaned file(s)`);

  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  // PRD §8 gives a hard budget: < 8MB of audio per unit, because Miguel is on
  // mobile data. Report it every run so a regression is impossible to miss.
  const perUnit = new Map<string, number>();
  for (const clip of Object.values(manifest.clips)) {
    if (clip.unitId) perUnit.set(clip.unitId, (perUnit.get(clip.unitId) ?? 0) + clip.bytes);
  }
  for (const scene of Object.values(manifest.scenes)) {
    perUnit.set(scene.unitId, (perUnit.get(scene.unitId) ?? 0) + scene.bytes);
  }
  for (const r of Object.values(manifest.recordings)) {
    perUnit.set(r.contrast, (perUnit.get(r.contrast) ?? 0) + r.bytes);
  }
  console.log("\n  Download size per unit (PRD §8 budget: 8 MB)");
  for (const [unitId, bytes] of [...perUnit].sort()) {
    const over = bytes > 8 * 1024 * 1024 ? "  ← OVER BUDGET" : "";
    console.log(`    ${unitId.padEnd(10)} ${humanBytes(bytes).padStart(8)}${over}`);
  }

  if (rec.missing) {
    const byContrast = new Map<string, Set<string>>();
    for (const r of plan.recordings.filter((x) => !x.present)) {
      if (!byContrast.has(r.contrast)) byContrast.set(r.contrast, new Set());
      byContrast.get(r.contrast)!.add(r.speakerId);
    }
    console.log(`\n  Ear training: ${rec.missing} recording(s) still unread (PRD 8.1B)`);
    for (const [contrast, speakers] of byContrast) {
      console.log(`    ${contrast.padEnd(10)} waiting on ${[...speakers].sort().join(", ")}`);
    }
    console.log(`    These are human recordings by design and will never be generated here.`);
    console.log(`    npm run content:recording-kit -- --contrast=<id> --speaker=<id>\n`);
  }

  if (failures.length) {
    console.log(`\n  ${failures.length} failure(s)`);
    for (const f of failures.slice(0, 10)) console.log(`    ✗ ${f.spec.ownerId} (${f.spec.voiceId}): ${f.error}`);
    if (failures.length > 10) console.log(`    ... and ${failures.length - 10} more`);
    console.log("");
    process.exit(1);
  }

  console.log(`\n  ✓ manifest written to ${path.relative(process.cwd(), MANIFEST)}\n`);
}

main().catch((e) => {
  console.error(`\n  ✗ ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
