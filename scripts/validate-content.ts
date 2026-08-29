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
import { CONTRASTS, MIN_FRAME_FILLERS, expandFrame, type Unit } from "../lib/content/types";
import {
  buildKnownWordTimeline,
  buildReleaseTimeline,
  loadContent,
  loadVocabSchedule,
  loadSpeakerRoster,
  loadVoiceRoster,
  unitChunkWords,
  unitTaughtWords,
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
import { rateProblems, type RateClip } from "../lib/content/speech-rate";
import { classifyCognate, loadCognateData } from "../lib/content/cognates";
import { morphologicalVariants, tokenizeTranscript } from "../lib/content/tokenize";
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
 * Where a frame starts paying for itself.
 *
 * `MIN_FRAME_FILLERS` is the schema floor -- below it the thing is not a frame.
 * This is the bar the design rests on: one pattern and N fillers is N sentences
 * for the price of one authored item, and that ratio is why the type exists.
 *
 * Was 8, lowered to 5 once Block 1 was finished, because 8 turned out to be
 * aspirational rather than derived. **Some filler classes are closed.** A week
 * has seven days, so `I work on {DAY}` can never reach eight however well it is
 * authored; the male relatives an A0 learner has met number five. A threshold
 * a correct frame cannot satisfy is not a standard, it is noise, and noise is
 * what gets a check deleted.
 *
 * Five still catches the real failure -- a frame with three or four fillers,
 * which is a handful of chunks wearing a pattern's clothes.
 */
const RECOMMENDED_FRAME_FILLERS = 5;

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
  const frameIds = new Map<string, string>();

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
    for (const frame of unit.frames) {
      const prev = frameIds.get(frame.id);
      if (prev) err(unit.unit_id, `frame id ${frame.id} is already used in ${prev}`);
      else frameIds.set(frame.id, unit.unit_id);
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

  // [PRD F12] A mission the learner cannot attempt is worse than no mission.
  const missionIds = new Set<string>();
  for (const mission of unit.missions) {
    if (missionIds.has(mission.id)) err(where, `duplicate mission id ${mission.id}`);
    missionIds.add(mission.id);

    for (const ref of mission.prep_chunk_ids) {
      if (!ids.has(ref)) {
        err(where, `${mission.id} prepares with ${ref}, which this unit does not teach`);
      }
    }

    // The escalation is the design: a difficulty-5 phone call dropped into unit
    // one is how a learner decides this product is not for them.
    //
    // Position within the block counts, not just the block. Unit 6 is six
    // units of practice further along than unit 1, and ordering at a counter
    // in English at the end of Block 1 is not the same ask as saying one word
    // to a stranger at the start of it. The ceiling therefore rises once in
    // the back half of a block. `difficulty` is shown to the learner and
    // orders which mission is offered first, so understating it is not a safe
    // default -- it mislabels the task.
    const ceiling = Math.min(5, unit.block + (unit.order >= 4 ? 2 : 1));
    if (mission.difficulty > ceiling) {
      warn(
        where,
        `${mission.id} is difficulty ${mission.difficulty} in block ${unit.block}`,
        `missions escalate with the course; ${ceiling} is the ceiling here`,
      );
    }
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

  // A question asked twice in one unit is a question the learner answers from
  // memory the second time. `¿Cuántas personas hablan?` and `¿De dónde es
  // María?` were each authored into two scenes before anyone noticed.
  const askedIn = new Map<string, string>();
  for (const scene of unit.scenes) {
    for (const q of scene.questions) {
      const prompt = (q.q_es ?? q.q_en ?? "").trim().toLowerCase();
      if (!prompt) continue;
      const first = askedIn.get(prompt);
      if (first) {
        err(where, `${scene.id} repeats a question already asked in ${first}`, q.q_es ?? q.q_en);
      } else {
        askedIn.set(prompt, scene.id);
      }
    }
  }

  // A question whose options are the cast list is answerable by reading the
  // speaker labels, which are on screen throughout Absorb by design. It looks
  // like comprehension and measures nothing.
  for (const scene of unit.scenes) {
    const speakers = new Set(
      parseTranscriptLines(scene.transcript).map((l) => l.speaker.toLowerCase()),
    );
    for (const [i, q] of scene.questions.entries()) {
      const options = q.options_es ?? q.options_en ?? [];
      const namesOnly = options.filter((o) => speakers.has(o.trim().toLowerCase()));
      if (options.length > 0 && namesOnly.length === options.length) {
        warn(
          where,
          `${scene.id} question ${i + 1} offers only speaker names`,
          "answerable from the transcript on screen without understanding the English",
        );
      }
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

/**
 * Frames (see `FrameSchema`) — the generative layer.
 *
 * A frame is only worth anything if the learner can actually fill it, so the
 * one rule that matters is ordering: every filler must be a chunk the
 * curriculum has already taught, in this unit or an earlier one. A filler
 * pointing forward is the frame equivalent of a scene that fails the 95% rule,
 * except it fails silently -- the card renders, the learner reads an option
 * they have never met, and concludes they forgot it.
 */
function checkFrames(bundle: ContentBundle) {
  // Where each chunk is taught, as a position in curriculum order.
  const taughtAt = new Map<string, number>();
  bundle.units.forEach((unit, i) => {
    for (const chunk of unit.chunks) if (!taughtAt.has(chunk.id)) taughtAt.set(chunk.id, i);
  });
  const chunkText = new Map(bundle.units.flatMap((u) => u.chunks.map((c) => [c.id, c.en] as const)));
  const timeline = buildKnownWordTimeline(bundle.units);

  bundle.units.forEach((unit, index) => {
    const where = unit.unit_id;
    const countCognates = cognateCreditAllowed(unit.cefr);
    const known = timeline.during.get(unit.unit_id)!;

    for (const frame of unit.frames) {
      const usable: string[] = [];

      for (const ref of frame.fillers) {
        const at = taughtAt.get(ref);
        if (at === undefined) {
          err(where, `${frame.id} is filled by ${ref}, which no unit teaches`);
          continue;
        }
        if (at > index) {
          err(
            where,
            `${frame.id} is filled by ${ref}, taught later in ${bundle.units[at].unit_id}`,
            "a frame may only be filled with chunks the learner has already met",
          );
          continue;
        }
        usable.push(ref);
      }

      // Every sentence the frame can produce has to read. For chunk fillers
      // this holds by construction -- pattern words are taught by this unit,
      // filler words by an earlier one -- and is asserted rather than assumed,
      // because this is the sentence the learner is graded on and a
      // disagreement between the timeline and a frame should surface here.
      //
      // For literal fillers it is the actual gate: `My name is {NAME}` is only
      // honest if the learner has met whatever goes in NAME, and proper nouns
      // and cognates are exactly what the readability scorer already credits.
      const expansions: [label: string, text: string][] = [
        ...usable.map((ref) => [ref, chunkText.get(ref)!] as [string, string]),
        ...frame.literal_fillers.map((lit) => [`"${lit}"`, lit] as [string, string]),
      ];
      for (const [label, filler] of expansions) {
        const sentence = expandFrame(frame.pattern, frame.slot, filler);
        const report = scoreText(sentence, known, { countCognates });
        if (!report.passes) {
          err(
            where,
            `${frame.id} + ${label} produces unknown words`,
            `"${sentence}" -> ${report.unknown.join(", ")}`,
          );
        }
      }

      // The whole argument for frames is that authoring cost stops scaling with
      // what is taught. Three fillers clears the schema and does not deliver it.
      const usableTotal = usable.length + frame.literal_fillers.length;
      if (usableTotal < RECOMMENDED_FRAME_FILLERS) {
        warn(
          where,
          `${frame.id} has ${usableTotal} usable filler(s)`,
          `>=${RECOMMENDED_FRAME_FILLERS} is where a frame starts out-earning the chunks it costs ` +
            `(the schema floor is ${MIN_FRAME_FILLERS})`,
        );
      }
    }
  });
}

/**
 * The listening library (`docs/ROADMAP.md` #4).
 *
 * One rule carries the whole idea: **a track introduces nothing.** It is
 * gated at 100% known, not 95% -- every word must already be taught by this
 * unit or an earlier one -- because the entire point of the type is content
 * that costs no vocabulary. A track that slips one new word in is a scene
 * without questions, and the course already has those.
 */
function checkListening(bundle: ContentBundle) {
  const timeline = buildKnownWordTimeline(bundle.units);
  const seenIds = new Map<string, string>();
  const manifestPath = path.join(process.cwd(), "content", "audio-manifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { scenes: Record<string, { durationMs: number }> })
    : null;

  for (const unit of bundle.units) {
    const tracks = bundle.listening.get(unit.unit_id) ?? [];
    if (tracks.length === 0) continue;
    const where = unit.unit_id;
    const known = timeline.during.get(unit.unit_id)!;
    const countCognates = cognateCreditAllowed(unit.cefr);
    const missing: string[] = [];
    let totalMs = 0;

    for (const track of tracks) {
      const prev = seenIds.get(track.id);
      if (prev) err(where, `listening track id ${track.id} is already used in ${prev}`);
      seenIds.set(track.id, where);

      if (!bundle.cast.has(track.character)) {
        err(where, `${track.id} belongs to "${track.character}", who is not in the cast`);
      }
      for (const line of parseTranscriptLines(track.transcript)) {
        if (!bundle.cast.has(line.speaker)) {
          err(where, `${track.id} has a line from "${line.speaker.toUpperCase()}", who is not in the cast`);
        }
      }

      const report = scoreTranscript(track.transcript, known, { countCognates });
      if (report.unknown.length > 0) {
        err(
          where,
          `${track.id} introduces ${report.unknown.length} word(s); a listening track introduces none`,
          report.unknown.join(", "),
        );
      } else {
        console.log(`    ${track.id}  100.0%  ${String(report.total).padStart(3)} tokens  (listening)`);
      }

      const ms = manifest?.scenes[track.id]?.durationMs;
      if (ms === undefined) missing.push(track.id);
      else totalMs += ms;
    }

    if (missing.length) {
      gate(where, `${missing.length}/${tracks.length} listening track(s) have no generated audio`, `${missing.join(", ")} — npm run content:audio`);
    } else {
      console.log(`    ${where} listening: ${tracks.length} track(s), ${(totalMs / 60000).toFixed(1)} min`);
    }
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
/**
 * [PRD 8.1A] The generated voices have to speak at the rate the roster asks for.
 *
 * The pipeline already proves the voices are *distinct* -- that guard exists
 * because Block 1 once shipped with three names for Samantha. This is the
 * missing half: distinct is not the same as appropriate. macOS `say` accepts
 * `-r 155` and ignores it, so the committed audio runs 90-136 wpm while every
 * voice declares 150-160, and in one scene the learner's own counterpart speaks
 * a third slower than the person answering him.
 *
 * A gate rather than an error: the audio is genuinely wrong today and the fix
 * is the engine decision (open item 4), which is a listening test nobody can
 * run in CI. It must not block authoring, and it must block publishing.
 */
function checkSpeechRate() {
  const file = path.join(process.cwd(), "content", "audio-manifest.json");
  if (!fs.existsSync(file)) return;

  const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as {
    clips: Record<string, RateClip & { url: string }>;
  };
  const clips = Object.values(manifest.clips);
  if (clips.length === 0) return;

  const declared = new Map(loadVoiceRoster().voices.map((v) => [v.id, v.rate_wpm]));

  for (const problem of rateProblems(clips, declared)) {
    gate(problem.where, problem.message, problem.detail);
  }
}

function checkGeneratedDurations(bundle: ContentBundle) {
  const manifestPath = path.join(process.cwd(), "content", "audio-manifest.json");
  if (!fs.existsSync(manifestPath)) return;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    provider: string;
    scenes: Record<string, { durationMs: number }>;
  };
  if (manifest.provider === "silent") return;

  for (const unit of bundle.units) {
    const missing: string[] = [];
    for (const scene of unit.scenes) {
      const actual = manifest.scenes[scene.id]?.durationMs;
      // A scene with no generated track used to be skipped in silence, so a
      // unit whose audio run was interrupted validated clean and every
      // duration check below simply did not happen. Found on 2026-08-28 when
      // `b1_u3` passed with zero of its six scenes stitched.
      if (actual === undefined) {
        missing.push(scene.id);
        continue;
      }
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

    if (missing.length) {
      gate(
        unit.unit_id,
        `${missing.length}/${unit.scenes.length} scene(s) have no generated audio`,
        `${missing.join(", ")} — npm run content:audio`,
      );
    }
  }
}

/**
 * The vocabulary release schedule (`content/vocab-schedule.yaml`).
 *
 * The 95% rule already catches a scene that runs ahead of the learner. This
 * catches a *unit* that runs ahead of the plan, which is a different and
 * earlier failure: by the time a scene fails readability, the chunks it was
 * written around have already been chosen.
 *
 * Deliberately an error and not a warning. The schedule is only useful if
 * stepping outside it is a decision someone makes on purpose -- adding the word
 * to the schedule is one line, and having to write that line is the entire
 * mechanism. Downgrade this to a warning and the file becomes decoration.
 *
 * Skipped entirely when no schedule exists, and per unit when that unit has no
 * entry: a plan that has not been written yet must not block the content that
 * has.
 */
function checkVocabSchedule(bundle: ContentBundle) {
  const schedule = loadVocabSchedule();
  if (!schedule) return;

  const timeline = buildReleaseTimeline(schedule);
  const cognates = loadCognateData(path.join(process.cwd(), "content"));

  for (const dupe of timeline.duplicates) {
    err(
      "vocab-schedule.yaml",
      `"${dupe.word}" is released more than once`,
      `claimed by ${dupe.units.join(", ")} -- release it in the earliest one only`,
    );
  }

  const scheduled = new Set(schedule.units.map((u) => u.unit));
  for (const unit of bundle.units) {
    if (!scheduled.has(unit.unit_id)) continue;
    const legal = timeline.legalBy.get(unit.unit_id)!;

    const late: string[] = [];
    for (const word of unitTaughtWords(unit)) {
      if (legal.has(word)) continue;
      // Released as an inflection of something legal ("names" for "name").
      if (morphologicalVariants(word).some((v) => legal.has(v))) continue;
      // Proper nouns and transparent cognates are credited by the readability
      // scorer and never taught, so the schedule does not carry them.
      const verdict = classifyCognate(word, cognates);
      if (verdict.cognate) continue;
      late.push(word);
    }

    if (late.length) {
      err(
        unit.unit_id,
        `teaches ${late.length} word(s) the schedule has not released`,
        `${late.sort().join(", ")} -- add them to ${unit.unit_id} in ` +
          "content/vocab-schedule.yaml, or rewrite to stay inside the plan",
      );
    }
  }
}

function checkCurriculumTargets(bundle: ContentBundle) {
  let chunks = 0;
  let frames = 0;
  for (const block of bundle.curriculum.blocks) {
    const units = block.units.map((id) => bundle.unitsById.get(id)!).filter(Boolean);
    chunks += units.reduce((n, u) => n + u.chunks.length, 0);
    frames += units.reduce((n, u) => n + u.frames.length, 0);
    if (units.length === 0) continue;
    if (chunks > block.chunk_target_cumulative) {
      warn(
        `block ${block.block}`,
        `cumulative chunk count ${chunks} exceeds the target ${block.chunk_target_cumulative}`
      );
    }
    if (frames > block.frame_target_cumulative) {
      warn(
        `block ${block.block}`,
        `cumulative frame count ${frames} exceeds the target ${block.frame_target_cumulative}`
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
  checkFrames(bundle);
  checkReadability(bundle);
  console.log("\n  Listening library (ROADMAP #4, 100% known)");
  checkListening(bundle);
  console.log("\n  HVPT drill sets (PRD F3)");
  checkContrasts(bundle, plan);
  checkGeneratedDurations(bundle);
  checkSpeechRate();
  checkVocabSchedule(bundle);
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
