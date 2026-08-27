import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import {
  CastSchema,
  ContrastSetSchema,
  CurriculumSchema,
  PronunciationOverridesSchema,
  SpeakerRosterSchema,
  UnitSchema,
  VoiceRosterSchema,
  type Cast,
  type Character,
  type Contrast,
  type ContrastSet,
  type Curriculum,
  type PronunciationOverride,
  type SpeakerRoster,
  type Unit,
  type VoiceRoster,
} from "./types";
import { tokenize } from "./tokenize";

const CONTENT_DIR = path.join(process.cwd(), "content");

export type ContentBundle = {
  curriculum: Curriculum;
  /** The recurring cast (PRD 4.3), indexed by id. */
  cast: Map<string, Character>;
  /** Units in curriculum order -- the order the cumulative word set is built in. */
  units: Unit[];
  unitsById: Map<string, Unit>;
  contrasts: Map<Contrast, ContrastSet>;
  /** Files that exist on disk but aren't referenced by the curriculum. */
  orphanUnitFiles: string[];
};

export class ContentError extends Error {
  constructor(readonly file: string, message: string) {
    super(`${file}: ${message}`);
    this.name = "ContentError";
  }
}

function readYaml(file: string): unknown {
  return YAML.parse(fs.readFileSync(file, "utf8"));
}

function parseOrThrow<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: unknown } },
  raw: unknown,
  file: string
): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = (result.error as { issues: { path: (string | number)[]; message: string }[] }).issues
      .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ContentError(path.basename(file), `schema errors\n${issues}`);
  }
  return result.data as T;
}

export function loadContent(contentDir = CONTENT_DIR): ContentBundle {
  const curriculumFile = path.join(contentDir, "curriculum.yaml");
  const curriculum = parseOrThrow<Curriculum>(
    CurriculumSchema,
    readYaml(curriculumFile),
    curriculumFile
  );

  const unitsDir = path.join(contentDir, "units");
  const onDisk = fs.existsSync(unitsDir)
    ? fs.readdirSync(unitsDir).filter((f) => f.endsWith(".yaml"))
    : [];

  const units: Unit[] = [];
  const unitsById = new Map<string, Unit>();
  const referenced = new Set<string>();

  for (const block of [...curriculum.blocks].sort((a, b) => a.block - b.block)) {
    for (const unitId of block.units) {
      const file = path.join(unitsDir, `${unitId}.yaml`);
      referenced.add(`${unitId}.yaml`);
      if (!fs.existsSync(file)) {
        throw new ContentError(
          "curriculum.yaml",
          `block ${block.block} references ${unitId}, but content/units/${unitId}.yaml does not exist`
        );
      }
      const unit = parseOrThrow<Unit>(UnitSchema, readYaml(file), file);
      if (unit.unit_id !== unitId) {
        throw new ContentError(`${unitId}.yaml`, `declares unit_id "${unit.unit_id}"`);
      }
      if (unit.block !== block.block) {
        throw new ContentError(
          `${unitId}.yaml`,
          `declares block ${unit.block} but the curriculum lists it under block ${block.block}`
        );
      }
      units.push(unit);
      unitsById.set(unitId, unit);
    }
  }

  const contrastsDir = path.join(contentDir, "contrasts");
  const contrasts = new Map<Contrast, ContrastSet>();
  if (fs.existsSync(contrastsDir)) {
    for (const file of fs.readdirSync(contrastsDir).filter((f) => f.endsWith(".yaml"))) {
      const full = path.join(contrastsDir, file);
      const set = parseOrThrow<ContrastSet>(ContrastSetSchema, readYaml(full), full);
      if (contrasts.has(set.contrast)) {
        throw new ContentError(file, `duplicate contrast set for "${set.contrast}"`);
      }
      contrasts.set(set.contrast, set);
    }
  }

  const castFile = path.join(contentDir, "characters.yaml");
  const castDoc = parseOrThrow<Cast>(CastSchema, readYaml(castFile), castFile);
  const cast = new Map<string, Character>();
  for (const character of castDoc.characters) {
    if (cast.has(character.id)) {
      throw new ContentError("characters.yaml", `duplicate character id "${character.id}"`);
    }
    cast.set(character.id, character);
  }

  return {
    curriculum,
    cast,
    units,
    unitsById,
    contrasts,
    orphanUnitFiles: onDisk.filter((f) => !referenced.has(f)),
  };
}

/* -------------------------------------------------------------------------- */
/* Voices, speakers, overrides                                                 */
/* -------------------------------------------------------------------------- */

export function loadVoiceRoster(contentDir = CONTENT_DIR): VoiceRoster {
  const file = path.join(contentDir, "voices.yaml");
  return parseOrThrow<VoiceRoster>(VoiceRosterSchema, readYaml(file), file);
}

export function loadSpeakerRoster(contentDir = CONTENT_DIR): SpeakerRoster {
  const file = path.join(contentDir, "speakers.yaml");
  return parseOrThrow<SpeakerRoster>(SpeakerRosterSchema, readYaml(file), file);
}

/**
 * Text substitutions applied before synthesis (PRD 8.1A). Returns a resolver
 * rather than the raw list: the caller only ever wants "what do I send to the
 * engine for this text", and the whole-word matching is easy to get wrong twice.
 */
export function loadPronunciationOverrides(contentDir = CONTENT_DIR) {
  const file = path.join(contentDir, "pronunciation-overrides.yaml");
  const doc = fs.existsSync(file)
    ? parseOrThrow<{ overrides: PronunciationOverride[] }>(
        PronunciationOverridesSchema,
        readYaml(file),
        file
      )
    : { overrides: [] as PronunciationOverride[] };

  const byWord = new Map(doc.overrides.map((o) => [o.word.toLowerCase(), o]));

  /**
   * Replace overridden words, matching whole words case-insensitively and
   * keeping everything else -- including punctuation and capitalisation -- as
   * the author wrote it.
   */
  return function spellForSynthesis(text: string, provider: string): string {
    if (byWord.size === 0) return text;
    return text.replace(/[A-Za-z][A-Za-z'-]*/g, (word) => {
      const override = byWord.get(word.toLowerCase());
      if (!override) return word;
      return override.providers?.[provider] ?? override.say;
    });
  };
}

export type SpellForSynthesis = ReturnType<typeof loadPronunciationOverrides>;

/**
 * Where a human ear-training recording lives (PRD 8.1B). Convention over
 * configuration: 25 pairs x 6 speakers is 300 paths nobody would keep accurate
 * by hand, and a stale one is a silent hole in the drill.
 */
export function recordingPath(
  contrast: string,
  speakerId: string,
  word: string,
  contentDir = CONTENT_DIR
): string {
  return path.join(contentDir, "recordings", contrast, speakerId, `${word.toLowerCase()}.wav`);
}

/**
 * Words a unit puts on cards: the chunk itself plus its example sentence.
 *
 * Both live on the card (PRD F2 card design: the chunk, and the chunk inside a
 * full example sentence, each with audio), so both are drilled -- which is why
 * they count toward the known set while incidental scene exposure does not.
 */
export function unitChunkWords(unit: Unit): Set<string> {
  const words = new Set<string>();
  for (const chunk of unit.chunks) for (const t of tokenize(chunk.en)) words.add(t);
  return words;
}

export function unitExampleWords(unit: Unit): Set<string> {
  const words = new Set<string>();
  for (const chunk of unit.chunks) for (const t of tokenize(chunk.example_en)) words.add(t);
  return words;
}

export function unitTaughtWords(unit: Unit): Set<string> {
  return new Set([...unitChunkWords(unit), ...unitExampleWords(unit)]);
}

export type KnownWordTimeline = {
  /** Everything taught strictly before this unit. */
  before: Map<string, Set<string>>;
  /** `before` plus the unit's own chunks -- Stage 2 runs before Stage 3. */
  during: Map<string, Set<string>>;
};

/**
 * Build the cumulative known-word set at each point in the curriculum.
 *
 * A scene in unit N is gated against `during[N]`, not `before[N]`: the daily
 * loop introduces the unit's chunks in Stage 2 (Meet) and only then plays the
 * scene in Stage 3 (Absorb), so those chunks are legitimately known by then.
 */
export function buildKnownWordTimeline(units: Unit[]): KnownWordTimeline {
  const before = new Map<string, Set<string>>();
  const during = new Map<string, Set<string>>();
  const cumulative = new Set<string>();

  for (const unit of units) {
    before.set(unit.unit_id, new Set(cumulative));
    const taught = unitTaughtWords(unit);
    during.set(unit.unit_id, new Set([...cumulative, ...taught]));
    for (const w of taught) cumulative.add(w);
  }

  return { before, during };
}
