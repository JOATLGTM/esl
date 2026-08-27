import { z } from "zod";

/**
 * Content schemas (PRD F9).
 *
 * These are the authoritative shape of everything in `content/`. The seed
 * script and the validator both read through here, so a schema change is
 * caught at author time rather than at runtime in the session player.
 */

/** The nine Spanish-L1 interference points from PRD 4.4, in priority order. */
export const CONTRASTS = [
  "ee_ih", // 1. /iː/ vs /ɪ/          sheep / ship
  "schwa", // 2. /ə/                  about, sofa, banana
  "final_clusters", // 3. final consonant clusters  text, breakfast, worked
  "b_v", // 4. /b/ vs /v/           berry / very
  "s_onset", // 5. /s/ + consonant onset    school, Spain
  "aspiration", // 6. aspirated /p t k/        pin, top, cat
  "th", // 7. /θ/ /ð/              think, this
  "h_r", // 8. /h/ and English /r/  house, red
  "stress_intonation", // 9. word stress + falling intonation
] as const;
export type Contrast = (typeof CONTRASTS)[number];

/** Human-readable labels, Spanish-first (all learner-facing chrome is ES at A0). */
export const CONTRAST_LABELS: Record<Contrast, { es: string; en: string; example: string }> = {
  ee_ih: { es: "Vocales largas y cortas", en: "/iː/ vs /ɪ/", example: "sheep / ship" },
  schwa: { es: "La vocal débil", en: "schwa /ə/", example: "about, sofa" },
  final_clusters: { es: "Consonantes al final", en: "final clusters", example: "text, worked" },
  b_v: { es: "B y V", en: "/b/ vs /v/", example: "berry / very" },
  s_onset: { es: "Palabras que empiezan con S", en: "/s/ + consonant", example: "school, Spain" },
  aspiration: { es: "P, T, K con aire", en: "aspirated /p t k/", example: "pin, top, cat" },
  th: { es: "El sonido TH", en: "/θ/ /ð/", example: "think, this" },
  h_r: { es: "H y R inglesas", en: "/h/ and /r/", example: "house, red" },
  stress_intonation: { es: "Acento y entonación", en: "stress + intonation", example: "PHOtograph" },
};

export const CEFR_LEVELS = ["A0", "A1", "A1+", "A2", "A2+", "B1"] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

/** PRD 4.5 — speaking task progression. */
export const SPEAKING_MODES = ["scripted", "guided", "free"] as const;

const chunkId = z.string().regex(/^c_\d{4}$/, "chunk id must look like c_0412");
const sceneId = z.string().regex(/^s_\d{4}$/, "scene id must look like s_0088");
const unitId = z.string().regex(/^b\d_u\d$/, "unit id must look like b2_u3");
const characterId = z.string().regex(/^[a-z][a-z0-9_]*$/, "character id must be lowercase, like maria");

/**
 * `audio: [auto]` means "the TTS pipeline owns this file". Anything else is a
 * hand-recorded override — used for the top contrasts if the week-1 TTS spike
 * shows the synthetic voices aren't acoustically variable enough (PRD §8).
 */
export const AudioSpec = z.union([
  z.tuple([z.literal("auto")]),
  z.array(
    z.object({
      speaker_id: z.string().min(1),
      url: z.string().min(1),
      accent: z.string().min(1),
    })
  ).min(2, "a hand-authored chunk needs >=2 speakers (PRD F2)"),
]);

export const ChunkSchema = z.object({
  id: chunkId,
  en: z.string().min(1),
  es: z.string().min(1, "every chunk needs a Spanish gloss (PRD F9)"),
  cefr: z.enum(CEFR_LEVELS),
  example_en: z.string().min(1, "every chunk needs an English example (PRD F9)"),
  example_es: z.string().min(1, "every chunk needs a Spanish example (PRD F9)"),
  tags: z.array(z.string()).default([]),
  audio: AudioSpec,
});
export type Chunk = z.infer<typeof ChunkSchema>;

export const QuestionSchema = z.object({
  q_es: z.string().min(1).optional(),
  q_en: z.string().min(1).optional(),
  options_es: z.array(z.string().min(1)).min(2).max(4).optional(),
  options_en: z.array(z.string().min(1)).min(2).max(4).optional(),
  answer: z.number().int().min(0),
}).refine((q) => q.q_es || q.q_en, {
  message: "a question needs q_es (A0-A1) or q_en (A2+)",
});
export type Question = z.infer<typeof QuestionSchema>;

export const SceneSchema = z.object({
  id: sceneId,
  title_es: z.string().min(1),
  /** The scene belongs to this cast member (PRD F9). Must exist in characters.yaml. */
  character: characterId,
  /** PRD F4: 30-90s of natural speech. */
  duration_target_s: z.number().int().min(30).max(90),
  /**
   * Speaker-labelled dialogue, one line per turn: `ANA: Good morning.`
   *
   * Every speaker tag has to be a character id (PRD 4.3). Anonymous `A:` / `B:`
   * walk-ons are rejected, because a cast the learner recognises is the whole
   * immersion mechanism and it only works if the same people keep showing up.
   *
   * Sentence-level timings are filled in by the audio pipeline, not authored.
   */
  transcript: z.string().min(1),
  questions: z.array(QuestionSchema).length(3, "every scene needs exactly 3 comprehension questions"),
});
export type Scene = z.infer<typeof SceneSchema>;

export const SpeakingTaskSchema = z.object({
  mode: z.enum(SPEAKING_MODES),
  scenario_es: z.string().min(1),
  scenario_en: z.string().min(1),
  target_chunks: z.array(chunkId).min(1),
  /** Scripted mode (A0-A1) shows the learner the exact line to say. */
  script: z.array(z.object({
    speaker: z.enum(["ai", "user"]),
    en: z.string().min(1),
    es: z.string().optional(),
  })).optional(),
});
export type SpeakingTask = z.infer<typeof SpeakingTaskSchema>;

export const UnitSchema = z.object({
  unit_id: unitId,
  block: z.number().int().min(1).max(6),
  order: z.number().int().min(1),
  title_es: z.string().min(1),
  title_en: z.string().min(1),
  cefr: z.enum(CEFR_LEVELS),
  can_do_es: z.string().min(1),
  target_contrast: z.enum(CONTRASTS),
  chunks: z.array(ChunkSchema).min(1),
  scenes: z.array(SceneSchema).min(1),
  speaking_task: SpeakingTaskSchema,
});
export type Unit = z.infer<typeof UnitSchema>;

export const MinimalPairSchema = z.object({
  id: z.string().regex(/^mp_\d{4}$/, "minimal pair id must look like mp_0001"),
  word_a: z.string().min(1),
  word_b: z.string().min(1),
  /** IPA for each side, so the UI can show what the learner is listening for. */
  ipa_a: z.string().min(1),
  ipa_b: z.string().min(1),
  /**
   * No `audio` field, on purpose. Ear-training clips are human recordings
   * (PRD 8.1B), discovered by convention at
   *   content/recordings/<contrast>/<speaker_id>/<word>.wav
   * rather than listed by hand -- 25 pairs x 6 speakers is 300 URLs nobody
   * would keep accurate, and a stale one is a silent hole in the drill.
   */
});

export const ContrastSetSchema = z.object({
  contrast: z.enum(CONTRASTS),
  title_es: z.string().min(1),
  explain_es: z.string().min(1),
  /**
   * Which human speakers read this set (PRD F3: >=4, varied in gender and
   * accent, >=1 non-native-but-intelligible). Ids reference speakers.yaml --
   * one roster, so a speaker's licence and consent are recorded once.
   */
  speakers: z.array(z.string().min(1)).min(4, "HVPT needs >=4 distinct speakers (PRD F3)"),
  pairs: z.array(MinimalPairSchema).min(20, "HVPT needs >=20 minimal pairs per contrast (PRD F3)"),
});
export type ContrastSet = z.infer<typeof ContrastSetSchema>;

export const CurriculumSchema = z.object({
  blocks: z.array(z.object({
    block: z.number().int().min(1).max(6),
    title_es: z.string().min(1),
    cefr: z.enum(CEFR_LEVELS),
    /** Cumulative chunk target from PRD 4.3. */
    chunk_target_cumulative: z.number().int().positive(),
    can_do_es: z.string().min(1),
    /** Spanish taper level for this block (PRD 4.6), 1 = most support. */
    l1_support_level: z.number().int().min(1).max(5),
    units: z.array(unitId),
  })).min(1),
});
export type Curriculum = z.infer<typeof CurriculumSchema>;

/* -------------------------------------------------------------------------- */
/* Voices, cast, and the people who read the ear-training words                */
/* -------------------------------------------------------------------------- */

/**
 * A recurring character (PRD 4.3). `voice` is the only place a scene voice is
 * ever decided: one voice per character, across all six blocks, forever.
 */
export const CharacterSchema = z.object({
  id: characterId,
  name: z.string().min(1),
  voice: z.string().min(1),
  role_es: z.string().min(1),
  role_en: z.string().min(1),
  /**
   * `learner` marks the character the user is invited to identify with. He is
   * allowed to hesitate and to ask for repetition on the audio -- PRD 4.4's
   * framing is intelligibility, never accent elimination, and the cast should
   * demonstrate that rather than only assert it.
   */
  speaks_english: z.enum(["native", "learner"]),
});
export type Character = z.infer<typeof CharacterSchema>;

export const CastSchema = z.object({
  version: z.number().int().positive(),
  characters: z.array(CharacterSchema).min(1),
});
export type Cast = z.infer<typeof CastSchema>;

export const VoiceSchema = z.object({
  id: z.string().min(1),
  accent: z.string().min(1),
  gender: z.string().min(1),
  native: z.boolean(),
  /** A0 listening wants slightly-slowed-but-natural, never robot narration (PRD F4). */
  rate_wpm: z.number().int().min(90).max(220).optional(),
  provider_voice: z.record(z.string(), z.string()),
});
export type Voice = z.infer<typeof VoiceSchema>;

export const VoiceRosterSchema = z.object({
  version: z.number().int().positive(),
  provider: z.string().min(1),
  primary_accent: z.string().min(1),
  /** Synthesised in every voice to prove no two voices are secretly the same. */
  probe_text: z.string().min(1),
  voices: z.array(VoiceSchema).min(2),
  roles: z.record(z.string(), z.array(z.string())),
}).refine((r) => !("hvpt" in r.roles), {
  message:
    "voices.yaml must not define an `hvpt` role: ear-training audio is human " +
    "(PRD 8.1B). Add the speakers to content/speakers.yaml instead.",
});
export type VoiceRoster = z.infer<typeof VoiceRosterSchema>;

/** A real person (or a corpus talker) who reads minimal pairs. PRD 8.1B. */
export const SpeakerSchema = z.object({
  id: z.string().min(1),
  accent: z.string().min(1),
  gender: z.string().min(1),
  native: z.boolean(),
  /** L1 of the speaker, so a non-native accent can be described honestly. */
  l1: z.string().min(1),
  source: z.enum(["volunteer", "corpus"]),
  consent: z.enum(["pending", "on_file"]).default("pending"),
  license: z.string().min(1),
  status: z.enum(["planned", "recorded"]).default("planned"),
  /** Required for `source: corpus` -- see the refinement below. */
  corpus: z.string().min(1).optional(),
  corpus_speaker: z.string().min(1).optional(),
  attribution: z.string().min(1).optional(),
}).refine((s) => s.source !== "corpus" || (s.corpus && s.attribution), {
  message:
    "a corpus speaker needs `corpus` and `attribution` -- CC BY audio shipped " +
    "without its attribution is a licence breach, not an oversight",
});
export type Speaker = z.infer<typeof SpeakerSchema>;

export const SpeakerRosterSchema = z.object({
  version: z.number().int().positive(),
  min_speakers_per_contrast: z.number().int().min(4),
  speakers: z.array(SpeakerSchema).min(1),
});
export type SpeakerRoster = z.infer<typeof SpeakerRosterSchema>;

/**
 * Text substituted before synthesis only (PRD 8.1A). The learner always reads
 * the real spelling; this changes what the machine says, never what a word is.
 */
export const PronunciationOverrideSchema = z.object({
  word: z.string().min(1),
  say: z.string().min(1),
  /** Per-engine override, when espeak-ng and macOS disagree. */
  providers: z.record(z.string(), z.string()).optional(),
});
export type PronunciationOverride = z.infer<typeof PronunciationOverrideSchema>;

export const PronunciationOverridesSchema = z.object({
  version: z.number().int().positive(),
  overrides: z.array(PronunciationOverrideSchema).default([]),
});
