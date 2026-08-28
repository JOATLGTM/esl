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
const frameId = z.string().regex(/^f_\d{4}$/, "frame id must look like f_0031");
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
  /**
   * Other answers that are also correct (PRD F2).
   *
   * The grader forgives *form* -- case, punctuation, accents, contraction, a
   * length-scaled typo budget. It cannot know that "Thanks" is a fine answer
   * for "Thank you" while "Good night" is not a fine answer for "Good morning";
   * that is a judgement about the language and it belongs to whoever writes the
   * content. Empty for almost every chunk.
   */
  accepts: z.array(z.string()).default([]),
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
  /**
   * Who the learner is talking to. A cast id from characters.yaml, validated
   * like every other speaker tag -- `dialogues.character_id` is a not-null
   * foreign key, and an anonymous partner would be the one voice in the product
   * that belongs to nobody.
   */
  character: z.string().min(1),
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

/**
 * A real-world mission (PRD F12).
 *
 * The learner does this outside the app, with an actual person, and then says
 * how it went. Missions escalate across the course: one word to a stranger,
 * then an order, then a question, then a conversation, then a phone call.
 *
 * `alternate_es` is required rather than optional, and that is the whole ethics
 * of the feature: a learner with no English speakers anywhere near them must
 * have a real way to do this, not a consolation message. A mission without an
 * alternative is a mission that excludes the people who need the course most.
 */
export const MissionSchema = z.object({
  id: z.string().regex(/^m_\d{4}$/, "mission ids look like m_0001"),
  title_es: z.string().min(1),
  instructions_es: z.string().min(1),
  /** Chunks the learner should have met before this is offered. */
  prep_chunk_ids: z.array(chunkId).min(1),
  /** 1 is a single word to a stranger; 5 is a phone call. */
  difficulty: z.number().int().min(1).max(5),
  alternate_es: z.string().min(1),
});
export type Mission = z.infer<typeof MissionSchema>;

/* -------------------------------------------------------------------------- */
/* Frames: the generative layer                                               */
/* -------------------------------------------------------------------------- */

/**
 * Fewest fillers a frame needs before it is a frame.
 *
 * Two fillers is a pair of chunks with extra ceremony. The whole argument for
 * this type is that authoring cost stops scaling with what is taught, and that
 * only starts being true somewhere above a handful; ten to fifteen is where it
 * gets good.
 */
export const MIN_FRAME_FILLERS = 3;

/** Where the placeholder sits in a pattern: `I'd like {NP}, please.` */
const SLOT_RE = /\{([A-Za-z0-9_]+)\}/g;

export function slotsIn(text: string): string[] {
  return [...text.matchAll(SLOT_RE)].map((m) => m[1]);
}

/**
 * A pattern with one slot, plus the chunks licensed to fill it.
 *
 * The course teaches chunks -- whole phrases a beginner can deploy without
 * assembling anything. That is the right on-ramp and the wrong destination.
 * The formulaic-sequence research this pedagogy rests on treats chunks as raw
 * material for grammar: the learner gradually *unpacks* `I'd like a coffee`
 * into `[I'd like + NP]` and starts producing sentences nobody taught them.
 * That unpacking is the entire mechanism by which chunks eventually pay off,
 * and until this type existed nothing in the content model could represent it
 * -- a chunk was a fixed string and there was no way to author a pattern. A
 * course built only from fixed strings tops out as an excellent phrasebook: it
 * can say 2,500 things and cannot say the 2,501st.
 *
 * A frame is also the only item in `content/` whose authoring cost does not
 * scale with what it teaches. One pattern and fifteen already-taught fillers is
 * fifteen sentences, and because the fillers are chunks the learner has already
 * met, the 95% rule holds by construction rather than by luck.
 *
 * No `audio` field, deliberately. A frame is a *production* exercise -- the
 * learner builds the sentence and says it -- and generating a clip per
 * combination would be 200 frames x 15 fillers of synthesis to support an
 * exercise where the learner is the one talking.
 */
export const FrameSchema = z.object({
  id: frameId,
  /** The pattern, containing exactly one `{SLOT}`: `I'd like {NP}, please.` */
  pattern: z.string().min(1),
  /**
   * The same pattern in Spanish, slot included: `Me gustaría {NP}, por favor.`
   *
   * A translation of one *example* would teach the example. The learner needs
   * to see the shape with the hole still in it, which is the thing being
   * learned.
   *
   * The slot keeps its English name in both patterns, deliberately. Writing
   * `{SN}` here for *sintagma nominal* reads better to a Spanish speaker and
   * buys nothing: no UI ever renders the raw marker -- it becomes a blank or a
   * chooser -- so the only thing a second name can do is fail to match the
   * first.
   */
  es_pattern: z.string().min(1),
  /** The placeholder name, upper case, used in both patterns. */
  slot: z.string().regex(/^[A-Z][A-Z0-9_]*$/, "slot names are upper case, like NP or TIME"),
  /**
   * Chunks allowed in the slot, by id.
   *
   * Ids rather than free text, so a filler cannot be a phrase the learner has
   * never met: the validator resolves each one against what the curriculum has
   * actually taught by this point. This is the check that keeps a frame from
   * quietly becoming a way to smuggle in new vocabulary.
   */
  fillers: z.array(chunkId).default([]),
  /**
   * Fillers that are not chunks: names, places, numbers.
   *
   * Unit 1 is why this exists. Three of its "chunks" -- `My name is`, `I'm
   * from`, `This is` -- are frames wearing a chunk's clothes: none of them is a
   * sentence, each has a hole, and the hole is filled by something the
   * curriculum will never teach as a chunk because "Alex" and "Mexico" are not
   * vocabulary. Modelling only chunk-id fillers would have left the single most
   * obvious frame in the course inexpressible.
   *
   * The guarantee survives because these are gated the same way everything else
   * is: the validator scores each one against the known-word set at that point
   * in the curriculum, with the usual cognate and proper-noun credit. A literal
   * filler is not a licence to smuggle in vocabulary -- it is a licence to use
   * a word the learner already, demonstrably, has.
   */
  literal_fillers: z.array(z.string().min(1)).default([]),
  cefr: z.enum(CEFR_LEVELS),
  tags: z.array(z.string()).default([]),
}).superRefine((frame, ctx) => {
  const bad = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });

  for (const [field, text] of [["pattern", frame.pattern], ["es_pattern", frame.es_pattern]] as const) {
    const found = slotsIn(text);
    const mine = found.filter((s) => s === frame.slot);
    if (mine.length === 0) {
      bad(`${field} "${text}" has no {${frame.slot}} placeholder`);
    } else if (mine.length > 1) {
      bad(`${field} repeats {${frame.slot}}; a frame has exactly one slot`);
    }
    for (const other of new Set(found.filter((s) => s !== frame.slot))) {
      bad(`${field} contains {${other}}, but the declared slot is {${frame.slot}}`);
    }
  }

  if (new Set(frame.fillers).size !== frame.fillers.length) {
    bad("duplicate filler ids");
  }
  if (new Set(frame.literal_fillers).size !== frame.literal_fillers.length) {
    bad("duplicate literal fillers");
  }

  const total = frame.fillers.length + frame.literal_fillers.length;
  if (total < MIN_FRAME_FILLERS) {
    bad(
      `a frame needs >=${MIN_FRAME_FILLERS} fillers (chunk or literal); ` +
        `${total} is just chunks with extra steps`,
    );
  }
});
export type Frame = z.infer<typeof FrameSchema>;

/**
 * The sentence a learner actually produces, for one filler.
 *
 * Capitalisation matters here because a slot can open the pattern -- `{NP} is
 * closed today` with the filler `the bank` has to come out as "The bank", not
 * "the bank". The learner is being graded on this sentence.
 */
export function expandFrame(pattern: string, slot: string, filler: string): string {
  const out = pattern.replace(`{${slot}}`, filler);
  return pattern.startsWith(`{${slot}}`) ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

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
  /**
   * Patterns built from chunks the learner already has (see `FrameSchema`).
   *
   * Optional, and defaulted, because every unit authored before frames existed
   * is still valid content -- a unit with no frames teaches fixed chunks, which
   * is what the course did for its whole first block.
   */
  frames: z.array(FrameSchema).default([]),
  scenes: z.array(SceneSchema).min(1),
  speaking_task: SpeakingTaskSchema,
  /** Optional: a unit may ship before its missions are written. */
  missions: z.array(MissionSchema).default([]),
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
    /**
     * Cumulative *fixed chunk* target by the end of this block.
     *
     * The PRD's original numbers (150/400/700/1200/1800/2500 across six blocks)
     * were borrowed from vocabulary-size research, where B1 is ~2,500 word
     * *families* -- and then applied to chunks, which are a different unit
     * entirely. 1,600 chunks contain far fewer than 1,600 distinct words,
     * because function words repeat across every phrase. The targets here are
     * chunks, and only chunks; see `docs/CONTENT-BRIEF.md`.
     */
    chunk_target_cumulative: z.number().int().positive(),
    /**
     * Cumulative frame target by the end of this block.
     *
     * Tracked separately because a frame is not a chunk and the two do not
     * trade off one-for-one: one frame with a dozen fillers is a dozen
     * producible sentences, which is why the course can reach a real A2 on
     * ~850 chunks rather than the ~1,600 the old spine implied.
     */
    frame_target_cumulative: z.number().int().nonnegative().default(0),
    can_do_es: z.string().min(1),
    /** Spanish taper level for this block (PRD 4.6), 1 = most support. */
    l1_support_level: z.number().int().min(1).max(5),
    units: z.array(unitId),
  })).min(1),
});
export type Curriculum = z.infer<typeof CurriculumSchema>;

/* -------------------------------------------------------------------------- */
/* The vocabulary release schedule                                            */
/* -------------------------------------------------------------------------- */

/**
 * Which English words become legal in which unit.
 *
 * This exists to turn the 95% rule from something an author *discovers* into
 * something they *design against*. Today the rule is enforced at validation
 * time, so authoring a scene means writing it, running the validator, and
 * fighting whatever comes back -- which is exactly backwards, and it is the
 * main reason a unit costs 15 hours instead of 5.
 *
 * With a schedule, the author opens unit 7, reads the list of words that are
 * legal by then, writes inside it, and validation becomes a formality. The
 * constraint stops being an adversary and becomes the brief.
 *
 * A word is released **once**, in the earliest unit that may use it, and stays
 * legal forever after. Releasing it twice is an error rather than a no-op: the
 * duplicate always means one of the two units was planned without looking at
 * the other, and silently ignoring it would hide the thing worth knowing.
 *
 * The schedule may name units that do not exist yet -- that is the whole point
 * of planning ahead -- so nothing here requires a matching content file.
 */
export const VocabScheduleSchema = z.object({
  version: z.number().int().positive(),
  units: z.array(z.object({
    unit: unitId,
    /**
     * Word types first legal in this unit, lower case, one per entry.
     *
     * Inflections do not need their own entry: the check matches through the
     * same morphological variants the readability scorer uses, so releasing
     * `name` licenses `names`.
     */
    releases: z.array(z.string().min(1)).default([]),
    /** Free text for the author: what this unit is for, why these words. */
    note: z.string().optional(),
  })).min(1),
});
export type VocabSchedule = z.infer<typeof VocabScheduleSchema>;

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
  /**
   * How fast this Piper model speaks at `--length-scale 1.0`, measured.
   *
   * Piper has no words-per-minute setting -- it has `length_scale`, a
   * multiplier where higher is slower. Turning `rate_wpm` into a scale
   * therefore needs to know the model's own natural pace, and that is a
   * property of the trained voice which can only be measured, not declared.
   *
   * Re-measure whenever a `piper` model changes: `npm run content:spike`, then
   * words / (seconds / 60) over that voice's clips.
   */
  natural_wpm: z.number().int().min(60).max(260).optional(),
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
