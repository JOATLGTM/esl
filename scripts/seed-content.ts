#!/usr/bin/env -S npx tsx
/**
 * Seed the curriculum into Supabase (PRD F9, 8.3).
 *
 *   npm run content:seed -- --dry-run
 *   npm run content:seed
 *
 * Content tables are public-read and have no write policy at all, so this is
 * the only writer and the service-role key is the only key that can do it. That
 * key never reaches a browser: this is a script, run by a person, from a
 * terminal.
 *
 * Idempotent by upsert on the natural id. Re-seeding after editing one scene
 * rewrites one row, and re-seeding an unchanged repo changes nothing.
 *
 * Audio URLs come from content/audio-manifest.json, not from the YAML -- the
 * YAML says `audio: [auto]` forever, and only the manifest knows what the
 * pipeline actually produced.
 */
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "../lib/supabase/admin";
import { loadContent, loadSpeakerRoster, loadVoiceRoster } from "../lib/content/load";
import { parseTranscriptLines } from "../lib/content/audio-plan";
import type { ChunkAudio, PairAudio, TranscriptSegment } from "../lib/supabase/types";

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

/** PRD F2: a card that cannot be heard in two voices is not a card. */
const MIN_VOICES_PER_CHUNK = 2;

type Manifest = {
  provider: string;
  clips: Record<string, {
    url: string; kind: string; text: string; voiceId: string; ownerId: string; durationMs: number;
  }>;
  scenes: Record<string, {
    url: string; unitId: string; durationMs: number;
    segments: { start_ms: number; end_ms: number; character: string; en: string }[];
  }>;
  recordings: Record<string, {
    url: string; contrast: string; pairId: string; word: string; speakerId: string;
  }>;
};

function loadManifest(): Manifest {
  const file = path.join(process.cwd(), "content", "audio-manifest.json");
  if (!fs.existsSync(file)) {
    throw new Error("content/audio-manifest.json is missing — run `npm run content:audio` first.");
  }
  const m = JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
  m.recordings ??= {};
  return m;
}

const warnings: string[] = [];
const warn = (message: string) => warnings.push(message);

async function main() {
  const bundle = loadContent();
  const manifest = loadManifest();
  const speakerRoster = loadSpeakerRoster();
  // Accent is denormalised onto each audio row so the UI can label a voice
  // without loading the roster at runtime.
  const voiceAccent = new Map(loadVoiceRoster().voices.map((v) => [v.id, v.accent]));

  // ---- rows ---------------------------------------------------------------

  const blocks = bundle.curriculum.blocks.map((b) => ({
    block: b.block,
    title_es: b.title_es,
    cefr: b.cefr,
    can_do_es: b.can_do_es,
    chunk_target_cumulative: b.chunk_target_cumulative,
    l1_support_level: b.l1_support_level,
  }));

  const characters = [...bundle.cast.values()].map((c) => ({
    id: c.id,
    name: c.name,
    voice: c.voice,
    role_es: c.role_es,
    role_en: c.role_en,
    speaks_english: c.speaks_english,
  }));

  const speakers = speakerRoster.speakers.map((s) => ({
    id: s.id,
    accent: s.accent,
    gender: s.gender,
    native: s.native,
    l1: s.l1,
    source: s.source,
    attribution: s.attribution ?? null,
  }));

  const units = bundle.units.map((u) => ({
    id: u.unit_id,
    block: u.block,
    order: u.order,
    title_es: u.title_es,
    title_en: u.title_en,
    cefr: u.cefr,
    can_do_es: u.can_do_es,
    target_contrast: u.target_contrast,
  }));

  // Chunk audio, indexed by the chunk it belongs to.
  const chunkAudio = new Map<string, ChunkAudio[]>();
  for (const clip of Object.values(manifest.clips)) {
    if (clip.kind !== "chunk") continue;
    const list = chunkAudio.get(clip.ownerId) ?? [];
    list.push({ voice_id: clip.voiceId, url: clip.url, accent: voiceAccent.get(clip.voiceId) ?? "" });
    chunkAudio.set(clip.ownerId, list);
  }

  const chunks = bundle.units.flatMap((u) =>
    u.chunks.map((c) => {
      const audio = chunkAudio.get(c.id) ?? [];
      if (audio.length < MIN_VOICES_PER_CHUNK) {
        warn(`${c.id} has ${audio.length} voice(s); PRD F2 wants ${MIN_VOICES_PER_CHUNK}. Run \`npm run content:audio\`.`);
      }
      return {
        id: c.id,
        unit_id: u.unit_id,
        en_text: c.en,
        es_gloss: c.es,
        cefr: c.cefr,
        example_en: c.example_en,
        example_es: c.example_es,
        tags: c.tags,
        slots: [],
        audio_urls: audio,
      };
    })
  );

  const scenes = bundle.units.flatMap((u) =>
    u.scenes.map((s) => {
      const track = manifest.scenes[s.id];
      if (!track) warn(`${s.id} has no generated audio track; seeding it silent.`);

      // Prefer the manifest's timings. Without them a scene still seeds, but
      // tap-to-seek has nothing to seek to.
      const segments: TranscriptSegment[] = track
        ? track.segments.map((seg) => ({ ...seg }))
        : parseTranscriptLines(s.transcript).map((line) => ({
            start_ms: 0,
            end_ms: 0,
            character: line.speaker,
            en: line.text,
          }));

      return {
        id: s.id,
        unit_id: u.unit_id,
        title_es: s.title_es,
        character_id: s.character,
        audio_url: track?.url ?? null,
        duration_s: track ? Math.round(track.durationMs / 1000) : null,
        transcript: segments,
        questions: s.questions,
      };
    })
  );

  const contrastSets = [...bundle.contrasts.values()].map((set) => ({
    contrast: set.contrast,
    title_es: set.title_es,
    explain_es: set.explain_es,
  }));

  const pairAudio = new Map<string, PairAudio[]>();
  for (const rec of Object.values(manifest.recordings)) {
    const list = pairAudio.get(rec.pairId) ?? [];
    list.push({ speaker_id: rec.speakerId, word: rec.word, url: rec.url });
    pairAudio.set(rec.pairId, list);
  }

  const minimalPairs = [...bundle.contrasts.values()].flatMap((set) =>
    set.pairs.map((p) => ({
      id: p.id,
      contrast: set.contrast,
      word_a: p.word_a,
      word_b: p.word_b,
      ipa_a: p.ipa_a,
      ipa_b: p.ipa_b,
      audio: pairAudio.get(p.id) ?? [],
    }))
  );

  const unrecorded = minimalPairs.filter((p) => p.audio.length === 0).length;
  if (unrecorded) {
    warn(
      `${unrecorded}/${minimalPairs.length} minimal pairs have no audio. These are human ` +
        `recordings by design (PRD 8.1B) and Stage 1 of the daily loop has nothing to play ` +
        `until they exist.`
    );
  }

  /*
   * The speaking task, as a `dialogues` row.
   *
   * One per unit. It was authored and validated from the beginning but never
   * seeded, so Stage 5 had no source and the session skipped it -- authored
   * content that the product could not reach.
   *
   * `nodes` carries the whole script in one column on purpose: a dialogue is
   * read once and walked entirely client-side, so the core loop keeps working
   * offline and no turn costs a round trip (PRD F10).
   */
  const dialogues = bundle.units.map((u) => ({
    id: `${u.unit_id}_speaking`,
    unit_id: u.unit_id,
    scenario_es: u.speaking_task.scenario_es,
    scenario_en: u.speaking_task.scenario_en,
    character_id: u.speaking_task.character,
    mode: u.speaking_task.mode,
    nodes: {
      target_chunks: u.speaking_task.target_chunks,
      script: u.speaking_task.script ?? [],
    },
  }));

  /*
   * Missions (PRD F12).
   *
   * `prep_dialogue_id` points at the unit's speaking task, so the mission can
   * offer a rehearsal before the learner does it for real -- which is the whole
   * difference between "go talk to a stranger" and a thing a nervous person
   * will actually attempt.
   */
  const missions = bundle.units.flatMap((u) =>
    u.missions.map((m) => ({
      id: m.id,
      unit_id: u.unit_id,
      title_es: m.title_es,
      instructions_es: m.instructions_es,
      prep_chunk_ids: m.prep_chunk_ids,
      prep_dialogue_id: `${u.unit_id}_speaking`,
      difficulty: m.difficulty,
      alternate_es: m.alternate_es,
    }))
  );

  // ---- write --------------------------------------------------------------

  const batches: [string, Record<string, unknown>[], string][] = [
    // Order is foreign-key order, not alphabetical. Units reference blocks,
    // chunks and scenes reference units, scenes reference characters.
    ["blocks", blocks, "block"],
    ["characters", characters, "id"],
    ["speakers", speakers, "id"],
    ["units", units, "id"],
    ["chunks", chunks, "id"],
    ["scenes", scenes, "id"],
    // Dialogues reference units and characters, so they follow both.
    ["dialogues", dialogues, "id"],
    // Missions reference the dialogue, so they follow it.
    ["missions", missions, "id"],
    ["contrast_sets", contrastSets, "contrast"],
    ["minimal_pairs", minimalPairs, "id"],
  ];

  console.log(`\n  Seeding content${DRY_RUN ? " (dry run)" : ""}\n`);
  for (const [table, rows] of batches) {
    console.log(`    ${table.padEnd(15)} ${String(rows.length).padStart(4)} row(s)`);
  }

  if (DRY_RUN) {
    report();
    console.log("\n  --dry-run: nothing written.\n");
    return;
  }

  // Untyped for the loop only. Iterating tables by name collapses the client's
  // per-table overloads to `never`, and the alternative -- eight near-identical
  // hand-unrolled upserts -- hides the ordering that actually matters here.
  // The rows themselves are built from schema-validated content above.
  const supabase = createAdminClient() as unknown as SupabaseClient;
  console.log("");
  for (const [table, rows, conflict] of batches) {
    if (rows.length === 0) continue;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
    if (error) {
      throw new Error(`${table}: ${error.message}${error.hint ? `\n      hint: ${error.hint}` : ""}`);
    }
    console.log(`    ✓ ${table}`);
  }

  report();
  console.log("\n  ✓ content seeded\n");
}

function report() {
  if (!warnings.length) return;
  console.log(`\n  ${warnings.length} warning(s)`);
  for (const w of warnings) console.log(`    ! ${w}`);
}

main().catch((e) => {
  console.error(`\n  ✗ ${e instanceof Error ? e.message : e}\n`);
  process.exit(1);
});
