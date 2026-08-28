#!/usr/bin/env -S npx tsx
/**
 * Content validator (PRD F9).
 *
 * Run: `npm run content:validate`
 *
 * The PRD names four hard rejection rules; they are marked [PRD] below. The
 * rest are the ones you find out you needed the first time a unit ships with a
 * dangling chunk reference.
 *
 * Exit code 1 on any error. Warnings never fail the build -- they are the
 * "authored but not publishable yet" signals, mostly missing generated audio.
 */
import { CONTRASTS, type Unit } from "../lib/content/types";
import {
  buildKnownWordTimeline,
  loadContent,
  loadSpeakerRoster,
  loadVoiceRoster,
  unitChunkWords,
  ContentError,
  type ContentBundle,
} from "../lib/content/load";
import { buildAudioPlan, parseTranscriptLines, type AudioPlan } from "../lib/content/audio-plan";
import {
  READABILITY_THRESHOLD,
  cognateCreditAllowed,
  scoreText,
  scoreTranscript,
  unknownBudget,
} from "../lib/content/readability";
import { tokenizeTranscript } from "../lib/content/tokenize";
import fs from "node:fs";
import path from "node:path";

/** [PRD] A unit may not introduce more than 45 new chunks. */
const MAX_NEW_CHUNKS_PER_UNIT = 45;

/**
 * An example sentence is allowed a little more slack than a scene: it is short
 * (so the 95% rule leaves literally zero room), and every word in it is on the
 * card itself, glossed, with audio. Two new words is the ceiling.
 */
const EXAMPLE_UNKNOWN_FLOOR = 2;

/** PRD F2: a chunk needs >=2 speaker audio files before it can be published. */
const MIN_SPEAKERS_PER_CHUNK = 2;

/**
 * `--publish` turns every "authored but not shippable yet" warning into an
 * error. Run it before content reaches a learner; leave it off while writing,
 * or the first half-finished unit blocks the whole loop.
 */
const PUBLISH = process.argv.includes("--publish");


type Problem = { level: "error" | "warn"; where: string; message: string; detail?: string };

const problems: Problem[] = [];
const err = (where: string, message: string, detail?: string) =>
  problems.push({ level: "error", where, message, detail });
const warn = (where: string, message: string, detail?: string) =>
  problems.push({ level: "warn", where, message, detail });
/** Fine while authoring, fatal at publish time. */
const gate = (where: string, message: string, detail?: string) =>
  problems.push({ level: PUBLISH ? "error" : "warn", where, message, detail });

/**
 * Which voices each chunk actually has audio for, from the manifest. The YAML
 * says `auto` forever; only the manifest knows whether the pipeline has run.
 */
let manifestVoicesCache: Map<string, Set<string>> | undefined;
function loadManifestVoices(): Map<string, Set<string>> {
  if (manifestVoicesCache) return manifestVoicesCache;
  const file = path.join(process.cwd(), "content", "audio-manifest.json");
  const byOwner = new Map<string, Set<string>>();
  if (fs.existsSync(file)) {
    const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as {
      clips: Record<string, { kind: string; ownerId: string; voiceId: string; url: string }>;
    };
    for (const clip of Object.values(manifest.clips)) {
      if (clip.kind !== "chunk") continue;
      // A manifest entry whose file is gone is not audio.
      if (!fs.existsSync(path.join(process.cwd(), "public", clip.url))) continue;
      if (!byOwner.has(clip.ownerId)) byOwner.set(clip.ownerId, new Set());
      byOwner.get(clip.ownerId)!.add(clip.voiceId);
    }
  }
  manifestVoicesCache = byOwner;
  return byOwner;
}

function checkGlobalIdUniqueness(bundle: ContentBundle) {
  const chunkIds = new Map<string, string>();
  const sceneIds = new Map<string, string>();

  for (const unit of bundle.units) {
    for (const chunk of unit.chunks) {
      const prev = chunkIds.get(chunk.id);
      if (prev) err(unit.unit_id, `chunk id ${chunk.id} is already used in ${prev}`);
      else chunkIds.set(chunk.id, unit.unit_id);
    }
    for (const scene of unit.scenes) {
      const prev = sceneIds.get(scene.id);
      if (prev) err(unit.unit_id, `scene id ${scene.id} is already used in ${prev}`);
      else sceneIds.set(scene.id, unit.unit_id);
    }
  }
}

/**
 * The narrative spine (PRD 4.3): six recurring characters, one fixed voice
 * each, and no anonymous walk-ons. A learner who recognises Ana before she says
 * her name is getting immersion for free -- and that only survives if every
 * scene draws from the same cast.
 */
function checkCast(bundle: ContentBundle) {
  const roster = loadVoiceRoster();
  const voiceIds = new Set(roster.voices.map((v) => v.id));
  const usedVoices = new Map<string, string>();

  for (const character of bundle.cast.values()) {
    const where = `character:${character.id}`;
    if (!voiceIds.has(character.voice)) {
      err(where, `uses voice "${character.voice}", which is not in voices.yaml`);
      continue;
    }
    const owner = usedVoices.get(character.voice);
    if (owner) {
      err(
        where,
        `shares voice "${character.voice}" with ${owner}`,
        "two characters with one voice are indistinguishable on audio (PRD 4.3)"
      );
    } else {
      usedVoices.set(character.voice, character.id);
    }
  }

  const learners = [...bundle.cast.values()].filter((c) => c.speaks_english === "learner");
  if (learners.length === 0) {
    warn(
      "characters.yaml",
      "no character is marked `speaks_english: learner`",
      "the cast should include someone the learner can identify with (PRD 4.3)"
    );
  }

  for (const unit of bundle.units) {
    for (const scene of unit.scenes) {
      if (!bundle.cast.has(scene.character)) {
        err(unit.unit_id, `${scene.id} belongs to "${scene.character}", who is not in the cast`);
      }
      const speakers = new Set(parseTranscriptLines(scene.transcript).map((l) => l.speaker));
      for (const speaker of speakers) {
        if (!bundle.cast.has(speaker)) {
          err(
            unit.unit_id,
            `${scene.id} has a line from "${speaker.toUpperCase()}", who is not in the cast`,
            "add them to content/characters.yaml, or give the line to someone who already exists"
          );
        }
      }
      if (!speakers.has(scene.character)) {
        warn(unit.unit_id, `${scene.id} is filed under ${scene.character}, who never speaks in it`);
      }
    }
  }
}

function checkUnitStructure(unit: Unit, bundle: ContentBundle) {
  const where = unit.unit_id;

  // [PRD] no more than 45 new chunks per unit
  if (unit.chunks.length > MAX_NEW_CHUNKS_PER_UNIT) {
    err(where, `introduces ${unit.chunks.length} chunks; the cap is ${MAX_NEW_CHUNKS_PER_UNIT}`);
  }

  // [PRD] target_contrast must be one of the nine in PRD 4.4 (schema-enforced),
  // and the drill set it points at has to actually exist.
  if (!CONTRASTS.includes(unit.target_contrast)) {
    err(where, `unknown target_contrast "${unit.target_contrast}"`);
  } else if (!bundle.contrasts.has(unit.target_contrast)) {
    err(
      where,
      `target_contrast "${unit.target_contrast}" has no drill set`,
      `expected content/contrasts/${unit.target_contrast}.yaml`
    );
  }

  const ids = new Set(unit.chunks.map((c) => c.id));
  for (const ref of unit.speaking_task.target_chunks) {
    if (!ids.has(ref)) err(where, `speaking_task targets ${ref}, which this unit does not teach`);
  }

  // Scripted mode exists so an A0 learner never has to invent a sentence.
  if (unit.speaking_task.mode === "scripted" && !unit.speaking_task.script?.length) {
    err(where, "speaking_task.mode is 'scripted' but no script lines are given");
  }
  if (unit.speaking_task.script?.length) {
    if (!unit.speaking_task.script.some((l) => l.speaker === "user")) {
      err(where, "speaking_task script has no user line -- the learner never speaks");
    }
  }

  for (const scene of unit.scenes) {
    for (const [i, q] of scene.questions.entries()) {
      const options = q.options_es ?? q.options_en;
      if (!options) {
        err(where, `${scene.id} question ${i + 1} has no options`);
        continue;
      }
      if (q.answer >= options.length) {
        err(where, `${scene.id} question ${i + 1}: answer index ${q.answer} is out of range`);
      }
    }

    const speakers = new Set(
      scene.transcript.split("\n").map((l) => l.match(/^\s*([A-Za-z]+)\s*:/)?.[1]).filter(Boolean)
    );
    if (speakers.size < 2) {
      err(where, `${scene.id} has ${speakers.size} speaker(s); a scene is a conversation`);
    }
  }

  // Every correct answer sitting in the same slot makes the comprehension check
  // measure nothing: tapping the first option every time scores full marks
  // without listening. Authoring naturally drifts this way -- the true answer is
  // the one you think of first, so you type it first -- and b1_u1 shipped with
  // all 18 answers at index 0 before anyone noticed.
  //
  // The player shuffles options per session as well, so this is defence in
  // depth rather than the only guard. It is a warning and not an error because
  // it is a judgement about a whole unit, and a two-scene unit can honestly
  // land this way.
  const answerSlots = unit.scenes.flatMap((scene) => scene.questions.map((q) => q.answer));
  if (answerSlots.length >= 6 && new Set(answerSlots).size === 1) {
    warn(
      where,
      `all ${answerSlots.length} scene answers are option ${answerSlots[0] + 1}`,
      "a learner can score full marks without listening -- vary which option is correct",
    );
  }

  // [PRD F2] every chunk needs >=2 speaker audio files before publishing.
  //
  // `auto` means the TTS pipeline owns the file, so the YAML can never answer
  // "does this chunk have audio yet" -- only the manifest can. One aggregate
  // warning, not one per chunk, or the real problems get buried.
  const generated = loadManifestVoices();
  const pending: string[] = [];
  for (const chunk of unit.chunks) {
    if (chunk.audio[0] === "auto") {
      const voices = generated.get(chunk.id)?.size ?? 0;
      if (voices < MIN_SPEAKERS_PER_CHUNK) pending.push(chunk.id);
    } else if (chunk.audio.length < MIN_SPEAKERS_PER_CHUNK) {
      err(where, `${chunk.id} has ${chunk.audio.length} audio file(s); needs ${MIN_SPEAKERS_PER_CHUNK}`);
    }
  }
  if (pending.length) {
    gate(
      where,
      `${pending.length}/${unit.chunks.length} chunks have fewer than ${MIN_SPEAKERS_PER_CHUNK} generated voices`,
      "npm run content:audio"
    );
  }
}

function checkReadability(bundle: ContentBundle) {
  const timeline = buildKnownWordTimeline(bundle.units);

  for (const unit of bundle.units) {
    const where = unit.unit_id;
    const countCognates = cognateCreditAllowed(unit.cefr);
    const duringSet = timeline.during.get(unit.unit_id)!;

    // Examples are gated against prior knowledge plus this unit's chunks -- an
    // example may not smuggle in vocabulary the chunks never taught.
    const exampleKnown = new Set([...timeline.before.get(unit.unit_id)!, ...unitChunkWords(unit)]);
    for (const chunk of unit.chunks) {
      const report = scoreText(chunk.example_en, exampleKnown, { countCognates });
      const allowed = Math.max(unknownBudget(report.total), EXAMPLE_UNKNOWN_FLOOR);
      const unknownCount = report.tokens.filter((t) => t.status === "unknown").length;
      if (unknownCount > allowed) {
        err(
          where,
          `${chunk.id} example introduces ${unknownCount} unknown words (max ${allowed})`,
          `"${chunk.example_en}" -> ${report.unknown.join(", ")}`
        );
      }
    }

    // [PRD] the 95% rule, on every scene.
    for (const scene of unit.scenes) {
      const report = scoreTranscript(scene.transcript, duringSet, { countCognates });
      const pct = (report.score * 100).toFixed(1);
      if (!report.passes) {
        err(
          where,
          `${scene.id} readability ${pct}% is below ${(READABILITY_THRESHOLD * 100).toFixed(0)}%`,
          `${report.total} tokens, budget ${unknownBudget(report.total)} unknown -> ${report.unknown.join(", ")}`
        );
      } else {
        console.log(
          `    ${scene.id}  ${pct.padStart(5)}%  ${String(report.total).padStart(3)} tokens` +
            `  ${report.cognate} cognate` +
            (report.unknown.length ? `  new: ${report.unknown.join(", ")}` : "")
        );
      }

      // Scene length has to be plausible for its duration target, or the audio
      // pipeline will produce something that races or drags.
      const wordCount = tokenizeTranscript(scene.transcript).length;
      const wps = wordCount / scene.duration_target_s;
      if (wps > 3.2) {
        warn(where, `${scene.id} is ${wordCount} words in ${scene.duration_target_s}s`, "likely too fast for A0");
      } else if (wps < 0.7) {
        warn(where, `${scene.id} is ${wordCount} words in ${scene.duration_target_s}s`, "likely too slow / lots of silence");
      }
    }
  }
}

/**
 * Cross-check authored duration targets against what the audio pipeline
 * actually produced. Only meaningful for real voices -- the `silent` provider
 * fakes its pacing, so comparing against it would just cry wolf.
 */
function checkGeneratedDurations(bundle: ContentBundle) {
  const manifestPath = path.join(process.cwd(), "content", "audio-manifest.json");
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    provider: string;
    scenes: Record<string, { durationMs: number }>;
  };
  if (manifest.provider === "silent") return;

  for (const unit of bundle.units) {
    for (const scene of unit.scenes) {
      const actual = manifest.scenes[scene.id]?.durationMs;
      if (actual === undefined) continue;
      const actualS = actual / 1000;
      if (actualS < 30 || actualS > 90) {
        err(unit.unit_id, `${scene.id} generated audio is ${actualS.toFixed(0)}s; PRD F4 requires 30-90s`);
      } else if (Math.abs(actualS - scene.duration_target_s) > scene.duration_target_s * 0.35) {
        warn(
          unit.unit_id,
          `${scene.id} targets ${scene.duration_target_s}s but generated ${actualS.toFixed(0)}s`,
          "adjust duration_target_s or the transcript length"
        );
      }
    }
  }
}

function checkCurriculumTargets(bundle: ContentBundle) {
  let cumulative = 0;
  for (const block of bundle.curriculum.blocks) {
    const units = block.units.map((id) => bundle.unitsById.get(id)!).filter(Boolean);
    cumulative += units.reduce((n, u) => n + u.chunks.length, 0);
    if (units.length === 0) continue;
    if (cumulative > block.chunk_target_cumulative) {
      warn(
        `block ${block.block}`,
        `cumulative chunk count ${cumulative} exceeds the target ${block.chunk_target_cumulative}`
      );
    }
  }
  for (const orphan of bundle.orphanUnitFiles) {
    warn("content/units", `${orphan} is not referenced by curriculum.yaml`);
  }
}

function checkContrasts(bundle: ContentBundle, plan: AudioPlan) {
  const roster = loadSpeakerRoster();
  const byId = new Map(roster.speakers.map((sp) => [sp.id, sp]));

  for (const [contrast, set] of bundle.contrasts) {
    const where = `contrast:${contrast}`;

    const speakers = set.speakers.map((id) => byId.get(id)).filter((sp) => sp !== undefined);
    for (const id of set.speakers) {
      if (!byId.has(id)) err(where, `references speaker "${id}", which is not in speakers.yaml`);
    }
    if (speakers.length < roster.min_speakers_per_contrast) {
      err(where, `has ${speakers.length} speakers; PRD F3 requires ${roster.min_speakers_per_contrast}`);
    }

    // PRD 4.4: the accents a learner has to cope with are not all native.
    if (!speakers.some((sp) => !sp.native)) {
      err(where, "needs at least one non-native-but-intelligible speaker (PRD 4.4)");
    }
    if (new Set(speakers.map((sp) => sp.gender)).size < 2) {
      err(where, "speakers must vary in gender (PRD 4.4)");
    }
    if (new Set(speakers.map((sp) => sp.accent)).size < 2) {
      err(where, "speakers must vary in accent (PRD 4.4)");
    }

    // Licensing is not paperwork: shipping a clip nobody agreed to, or CC BY
    // audio with no attribution, is a real problem with a real owner.
    for (const sp of speakers) {
      if (sp.source === "volunteer" && sp.consent !== "on_file") {
        gate(where, `${sp.id} has no consent on file`, "do not ship a voice that did not agree to be shipped");
      }
      if (sp.source === "corpus" && !sp.attribution) {
        err(where, `${sp.id} is corpus-sourced with no attribution string`);
      }
    }

    const seen = new Set<string>();
    for (const pair of set.pairs) {
      const key = `${pair.word_a}/${pair.word_b}`;
      if (seen.has(key)) err(where, `duplicate minimal pair ${key}`);
      seen.add(key);
      if (pair.word_a === pair.word_b) err(where, `${pair.id} is not a minimal pair`);
    }

    // The drill needs enough talkers who have actually read the WHOLE set. A
    // speaker who read 24 of 25 pairs cannot be scheduled against the 25th, and
    // "no two consecutive items share a speaker" (PRD F3) quietly stops holding.
    const recordings = plan.recordings.filter((r) => r.contrast === contrast);
    const complete = [...new Set(recordings.map((r) => r.speakerId))].filter((id) =>
      recordings.filter((r) => r.speakerId === id).every((r) => r.present)
    );
    const partial = [...new Set(recordings.filter((r) => r.present).map((r) => r.speakerId))].filter(
      (id) => !complete.includes(id)
    );

    const total = recordings.length;
    const have = recordings.filter((r) => r.present).length;
    console.log(
      `    ${contrast}  ${set.pairs.length} pairs x ${speakers.length} speakers = ${total} clips` +
        `  |  ${have} recorded, ${complete.length} speaker(s) complete`
    );

    if (complete.length < roster.min_speakers_per_contrast) {
      gate(
        where,
        `only ${complete.length} of ${speakers.length} speakers have read the whole set ` +
          `(PRD F3 needs ${roster.min_speakers_per_contrast})`,
        "human recordings, by design -- npm run content:recording-kit -- --contrast=" + contrast
      );
    }
    for (const id of partial) {
      const missing = recordings.filter((r) => r.speakerId === id && !r.present).length;
      warn(where, `${id} is ${missing} word(s) short of a complete set`);
    }
  }
}

function main() {
  let bundle: ContentBundle;
  try {
    bundle = loadContent();
  } catch (e) {
    if (e instanceof ContentError) {
      console.error(`\n  ✗ ${e.message}\n`);
      process.exit(1);
    }
    throw e;
  }

  console.log(
    `\n  Content check — ${bundle.units.length} unit(s), ${bundle.cast.size} character(s), ` +
      `${bundle.contrasts.size} contrast set(s)${PUBLISH ? "   [--publish: warnings are errors]" : ""}\n`
  );

  const plan = buildAudioPlan(bundle);

  console.log("  Readability (PRD F4, 95% rule)");
  checkGlobalIdUniqueness(bundle);
  checkCast(bundle);
  for (const unit of bundle.units) checkUnitStructure(unit, bundle);
  checkReadability(bundle);
  console.log("\n  HVPT drill sets (PRD F3)");
  checkContrasts(bundle, plan);
  checkGeneratedDurations(bundle);
  checkCurriculumTargets(bundle);

  const errors = problems.filter((p) => p.level === "error");
  const warnings = problems.filter((p) => p.level === "warn");

  if (warnings.length) {
    console.log(`\n  ${warnings.length} warning(s)`);
    for (const w of warnings) {
      console.log(`    ! ${w.where}: ${w.message}${w.detail ? `\n        ${w.detail}` : ""}`);
    }
  }

  if (errors.length) {
    console.log(`\n  ${errors.length} error(s)`);
    for (const e of errors) {
      console.log(`    ✗ ${e.where}: ${e.message}${e.detail ? `\n        ${e.detail}` : ""}`);
    }
    console.log("");
    process.exit(1);
  }

  console.log("\n  ✓ all content valid\n");
}

main();
