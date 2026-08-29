import crypto from "node:crypto";
import fs from "node:fs";
import {
  loadContent,
  loadPronunciationOverrides,
  loadSpeakerRoster,
  loadVoiceRoster,
  recordingPath,
  type ContentBundle,
  type SpellForSynthesis,
} from "./load";
import type { Speaker, SpeakerRoster, Voice as VoiceType, VoiceRoster } from "./types";

/**
 * The audio plan: every clip the product needs, derived from content.
 *
 * Splitting "what to generate" from "how to generate it" keeps the pipeline
 * idempotent and testable. The plan is pure -- no network, no filesystem writes
 * beyond checking whether a recording exists -- so `--dry-run` prints exactly
 * what a real run would do.
 *
 * There are two kinds of audio here and conflating them is the main way this
 * goes wrong (PRD 8.1):
 *
 *   clips       scripted content -- chunks, examples, scene lines. Synthesised
 *               locally by a TTS engine, once, and committed.
 *   recordings  ear training -- minimal pairs. Read by real humans, never
 *               synthesised, because talker variability IS the training
 *               mechanism and TTS voices do not have enough of it.
 */

/** Bumping this invalidates every cached clip. Change it when encoding changes. */
export const AUDIO_PIPELINE_VERSION = 2;

/** PRD 8: Opus 32kbps mono, target < 8MB per unit. */
export const AUDIO_FORMAT = { codec: "libopus", bitrate: "32k", channels: 1, ext: "opus" } as const;

export type Voice = VoiceType;
export type { VoiceRoster };
export { loadVoiceRoster };

export type ClipKind = "chunk" | "example" | "scene_line";

export type ClipSpec = {
  /** Stable content hash -- the cache key and the filename. */
  hash: string;
  kind: ClipKind;
  /** What the learner reads. */
  text: string;
  /** What the engine is asked to say -- differs where an override applies. */
  synthText: string;
  voiceId: string;
  /** Where this clip came from, for error messages and manifest lookup. */
  ownerId: string;
  unitId?: string;
  /** Ordering within a scene, used to stitch the dialogue track. */
  lineIndex?: number;
  relPath: string;
};

/**
 * One human-read minimal-pair word. `sourceFile` is where the recording is
 * expected; `present` says whether it is actually there yet. A missing
 * recording is a normal authoring state, not an error -- it means someone still
 * has to read the list.
 */
export type RecordingSpec = {
  hash: string;
  contrast: string;
  pairId: string;
  word: string;
  speakerId: string;
  sourceFile: string;
  present: boolean;
  relPath: string;
};

export type ScenePlan = {
  sceneId: string;
  unitId: string;
  lines: { index: number; character: string; text: string; clipHash: string }[];
  /** Hash of the stitched dialogue track. */
  trackHash: string;
  relPath: string;
};

export type AudioPlan = {
  clips: ClipSpec[];
  scenes: ScenePlan[];
  recordings: RecordingSpec[];
  roster: VoiceRoster;
  speakers: SpeakerRoster;
  /** Every voice, for the distinctness probe. */
  probeText: string;
};

/**
 * Cache key. The text actually sent to the engine participates, so editing a
 * pronunciation override regenerates exactly the clips containing that word.
 */
export function clipHash(synthText: string, voiceId: string, provider: string): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        AUDIO_PIPELINE_VERSION,
        provider,
        voiceId,
        synthText.trim(),
        AUDIO_FORMAT.codec,
        AUDIO_FORMAT.bitrate,
        AUDIO_FORMAT.channels,
      ])
    )
    .digest("hex")
    .slice(0, 16);
}

/** Recordings are keyed by the file they came from, not by any engine. */
export function recordingHash(contrast: string, speakerId: string, word: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([AUDIO_PIPELINE_VERSION, "human", contrast, speakerId, word.toLowerCase()]))
    .digest("hex")
    .slice(0, 16);
}

/** Split `ANA: Good morning.` into its speaker tag and its line. */
export function parseTranscriptLines(transcript: string): { speaker: string; text: string }[] {
  return transcript
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^([A-Za-z][A-Za-z0-9_]*)\s*:\s*(.*)$/);
      return m ? { speaker: m[1].toLowerCase(), text: m[2] } : { speaker: "", text: line };
    })
    .filter((l) => l.text.length > 0);
}

export class AudioPlanError extends Error {}

export function buildAudioPlan(
  bundle: ContentBundle = loadContent(),
  roster: VoiceRoster = loadVoiceRoster(),
  options: {
    speakers?: SpeakerRoster;
    spell?: SpellForSynthesis;
    contentDir?: string;
  } = {}
): AudioPlan {
  const provider = roster.provider;
  const speakers = options.speakers ?? loadSpeakerRoster(options.contentDir);
  const spell = options.spell ?? loadPronunciationOverrides(options.contentDir);

  const byId = new Map(roster.voices.map((v) => [v.id, v]));
  const role = (name: string): string[] => {
    const ids = roster.roles[name] ?? [];
    for (const id of ids) {
      if (!byId.has(id)) throw new AudioPlanError(`voices.yaml: role "${name}" references unknown voice "${id}"`);
    }
    return ids;
  };

  // One voice per character, across the whole track (PRD 4.3). This lookup is
  // the ONLY place a scene voice is decided -- no positional assignment, no
  // rotation, nothing that could give Ana a different voice in unit 22 than she
  // had in unit 3.
  const voiceForCharacter = (characterId: string, where: string): string => {
    const character = bundle.cast.get(characterId);
    if (!character) {
      throw new AudioPlanError(
        `${where}: "${characterId}" is not in the cast. Add them to content/characters.yaml ` +
          `or use an existing character -- anonymous walk-ons break the narrative spine (PRD 4.3).`
      );
    }
    if (!byId.has(character.voice)) {
      throw new AudioPlanError(
        `characters.yaml: ${character.id} uses voice "${character.voice}", which is not in voices.yaml`
      );
    }
    return character.voice;
  };

  const clips: ClipSpec[] = [];
  const scenes: ScenePlan[] = [];
  const seen = new Set<string>();
  const push = (spec: ClipSpec) => {
    // Two chunks with the same text and voice share one file. "Thank you"
    // appears in a lot of units; it should cost one clip, not twenty.
    if (seen.has(spec.hash)) return;
    seen.add(spec.hash);
    clips.push(spec);
  };

  const clip = (
    kind: ClipKind,
    text: string,
    voiceId: string,
    ownerId: string,
    extra: Partial<ClipSpec> = {}
  ): ClipSpec => {
    const synthText = spell(text.trim(), provider);
    const hash = clipHash(synthText, voiceId, provider);
    return {
      hash,
      kind,
      text: text.trim(),
      synthText,
      voiceId,
      ownerId,
      relPath: `${kind}/${hash}.${AUDIO_FORMAT.ext}`,
      ...extra,
    };
  };

  for (const unit of bundle.units) {
    for (const chunk of unit.chunks) {
      // PRD F2: >=2 speakers per chunk, non-negotiable before publish.
      for (const voiceId of [...role("chunk_primary"), ...role("chunk_extra")]) {
        push(clip("chunk", chunk.en, voiceId, chunk.id, { unitId: unit.unit_id }));
      }
      for (const voiceId of role("example")) {
        push(clip("example", chunk.example_en, voiceId, chunk.id, { unitId: unit.unit_id }));
      }
    }

    for (const scene of unit.scenes) {
      const parsed = parseTranscriptLines(scene.transcript);
      const lines = parsed.map((line, index) => {
        const voiceId = voiceForCharacter(line.speaker, `${scene.id} line ${index + 1}`);
        const spec = clip("scene_line", line.text, voiceId, scene.id, {
          unitId: unit.unit_id,
          lineIndex: index,
        });
        push(spec);
        return { index, character: line.speaker, text: line.text, clipHash: spec.hash };
      });

      const trackHash = crypto
        .createHash("sha256")
        .update(JSON.stringify([AUDIO_PIPELINE_VERSION, lines.map((l) => l.clipHash)]))
        .digest("hex")
        .slice(0, 16);

      scenes.push({
        sceneId: scene.id,
        unitId: unit.unit_id,
        lines,
        trackHash,
        relPath: `scene/${trackHash}.${AUDIO_FORMAT.ext}`,
      });
    }

    // Listening tracks are scene-shaped for the pipeline's purposes: lines in
    // cast voices, stitched into one file with timings. Same clips, same
    // stitch, same manifest -- only the id prefix (`l_`) tells them apart.
    for (const track of bundle.listening.get(unit.unit_id) ?? []) {
      const parsed = parseTranscriptLines(track.transcript);
      const lines = parsed.map((line, index) => {
        const voiceId = voiceForCharacter(line.speaker, `${track.id} line ${index + 1}`);
        const spec = clip("scene_line", line.text, voiceId, track.id, {
          unitId: unit.unit_id,
          lineIndex: index,
        });
        push(spec);
        return { index, character: line.speaker, text: line.text, clipHash: spec.hash };
      });
      const trackHash = crypto
        .createHash("sha256")
        .update(JSON.stringify([AUDIO_PIPELINE_VERSION, lines.map((l) => l.clipHash)]))
        .digest("hex")
        .slice(0, 16);
      scenes.push({
        sceneId: track.id,
        unitId: unit.unit_id,
        lines,
        trackHash,
        relPath: `scene/${trackHash}.${AUDIO_FORMAT.ext}`,
      });
    }
  }

  // Ear training: every word, read by every human speaker assigned to the set.
  // Nothing here is synthesised (PRD 8.1B) -- the plan reports what exists and
  // what is still waiting on someone to read it.
  const speakerById = new Map(speakers.speakers.map((s) => [s.id, s]));
  const recordings: RecordingSpec[] = [];
  for (const set of bundle.contrasts.values()) {
    for (const speakerId of set.speakers) {
      if (!speakerById.has(speakerId)) {
        throw new AudioPlanError(
          `contrasts/${set.contrast}.yaml references speaker "${speakerId}", which is not in speakers.yaml`
        );
      }
    }
    for (const pair of set.pairs) {
      for (const word of [pair.word_a, pair.word_b]) {
        for (const speakerId of set.speakers) {
          const sourceFile = recordingPath(set.contrast, speakerId, word, options.contentDir);
          const hash = recordingHash(set.contrast, speakerId, word);
          recordings.push({
            hash,
            contrast: set.contrast,
            pairId: pair.id,
            word,
            speakerId,
            sourceFile,
            present: fs.existsSync(sourceFile),
            relPath: `hvpt/${hash}.${AUDIO_FORMAT.ext}`,
          });
        }
      }
    }
  }

  return { clips, scenes, recordings, roster, speakers, probeText: roster.probe_text };
}

/** Speakers who have actually read a given contrast set, end to end. */
export function recordedSpeakers(plan: AudioPlan, contrast: string): Speaker[] {
  const byId = new Map(plan.speakers.speakers.map((s) => [s.id, s]));
  const forContrast = plan.recordings.filter((r) => r.contrast === contrast);
  const ids = [...new Set(forContrast.map((r) => r.speakerId))];
  return ids
    .filter((id) => forContrast.filter((r) => r.speakerId === id).every((r) => r.present))
    .map((id) => byId.get(id)!)
    .filter(Boolean);
}


