import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SpeakingMode } from "@/lib/supabase/types";
import { pickFrameIndex, type FrameFiller, type SessionFrame } from "./frame-drill";
import { formulationSeed, pickFormulation, type FormulationPrompt } from "./formulate";

/**
 * Stage 5, Speak (PRD 4.2 / 4.5 / F5): the learner says the phrases out loud.
 *
 * Scripted mode at A0-A1 means the exact line is on screen and success is
 * saying it, nothing more. There is no scoring, no pronunciation grade and no
 * pass mark, and that is the design rather than a simplification: the counter-
 * metric this whole product is built around is speaking minutes, and anything
 * that makes a beginner afraid to open their mouth costs more than it measures.
 *
 * The microphone is optional forever (PRD F1). Everything works without it;
 * granting it only adds a recording the learner can keep.
 */

export type SpeakLine = {
  speaker: "ai" | "user";
  en: string;
  es?: string;
  /** The line's clip: the character's voice for ai turns, the learner-counterpart's for user turns. */
  audioUrl: string | null;
};

export type SpeakTask = {
  id: string;
  mode: SpeakingMode;
  scenarioEs: string;
  scenarioEn: string;
  /** Whose half of the conversation the app is playing. */
  characterName: string;
  script: SpeakLine[];
  targetChunks: string[];
};

type NodeLine = { speaker: "ai" | "user"; en: string; es?: string; audio_url?: string | null };
type Nodes = { script?: NodeLine[]; target_chunks?: string[] };

/** The unit's speaking task, or null if none is authored yet. */
export async function loadSpeakTask(unitId: string, learnerName?: string): Promise<SpeakTask | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("dialogues")
    .select("id, mode, scenario_es, scenario_en, character_id, nodes, characters(name)")
    .eq("unit_id", unitId)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const nodes = (data.nodes as Nodes | null) ?? {};
  const character = data.characters as { name: string } | null;

  return {
    id: data.id,
    mode: data.mode,
    scenarioEs: data.scenario_es,
    scenarioEn: data.scenario_en,
    characterName: character?.name ?? data.character_id,
    // `{name}` is substituted here rather than in the component so the script
    // the learner reads and the script recorded against it are the same text.
    script: (nodes.script ?? []).map((line) => ({
      speaker: line.speaker,
      en: fillName(line.en, learnerName),
      es: line.es ? fillName(line.es, learnerName) : undefined,
      audioUrl: line.audio_url ?? null,
    })),
    targetChunks: nodes.target_chunks ?? [],
  };
}

/**
 * The learner has no name field yet, so `{name}` has nothing to fill from.
 * Left as-is it prints a literal placeholder in the one line the learner is
 * asked to say about themselves, which is worse than a generic word.
 */
function fillName(text: string, name?: string): string {
  return text.replaceAll("{name}", name?.trim() || "…");
}

/**
 * Record that the learner spoke.
 *
 * `sessions.speaking_tasks_completed` is a PRD 3 counter-metric and the reason
 * this stage exists, so it is incremented from the server on the strength of
 * finishing the script -- not from a self-report the client could inflate, and
 * not gated on a microphone that is optional.
 */
export async function recordSpeakingTask(sessionId: string, userId: string): Promise<void> {
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("speaking_tasks_completed")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!session) return;

  await supabase
    .from("sessions")
    .update({ speaking_tasks_completed: session.speaking_tasks_completed + 1 })
    .eq("id", sessionId)
    .eq("user_id", userId);
}

/**
 * Weeks since the learner signed up, 1-based.
 *
 * `speaking_samples.week_number` exists so the learner can hear week 1 against
 * week 12 (PRD F5) -- the single most motivating thing a speaking course can
 * show someone, and it only works if the number is anchored to their start
 * rather than to the calendar.
 */
export function weekNumber(createdAt: string, now: Date = new Date()): number {
  const started = Date.parse(createdAt);
  if (Number.isNaN(started)) return 1;
  const weeks = Math.floor((now.getTime() - started) / (7 * 86_400_000));
  return Math.max(1, weeks + 1);
}

/**
 * The frame this session offers, with its fillers resolved to real text.
 *
 * Fillers are stored as chunk ids, so the text has to be fetched -- and a
 * filler whose chunk has gone missing is dropped rather than rendered as an
 * id. The validator has already proved every id resolves, so a gap here means
 * content was seeded from a different curriculum than the one that validated,
 * and showing the learner `c_0412` would be the worst possible way to say so.
 *
 * Returns null when the unit has no frames, which is every unit today: the
 * type exists and nothing has been authored against it yet, and the stage is
 * written so that costs nothing.
 */
export async function loadSessionFrame(
  userId: string,
  unitId: string,
): Promise<SessionFrame | null> {
  const supabase = await createClient();

  const [{ data: frames }, { count }] = await Promise.all([
    supabase
      .from("frames")
      .select("id, pattern, es_pattern, slot, fillers, literal_fillers, filler_images")
      .eq("unit_id", unitId)
      .order("id"),
    // Sessions already finished in this unit, exactly as Absorb counts scenes:
    // the current one is still open, so the number is stable for its whole
    // duration and a reload picks the same frame.
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("unit_id", unitId)
      .not("completed_at", "is", null),
  ]);

  if (!frames?.length) return null;
  const frame = frames[pickFrameIndex(count ?? 0, frames.length)];

  const chunkIds = (frame.fillers as string[] | null) ?? [];
  const { data: chunks } = chunkIds.length
    ? await supabase.from("chunks").select("id, en_text").in("id", chunkIds)
    : { data: [] };

  const byId = new Map((chunks ?? []).map((c) => [c.id, c.en_text]));
  const fillers: FrameFiller[] = [
    ...chunkIds.flatMap((id) => {
      const text = byId.get(id);
      return text ? [{ key: id, text }] : [];
    }),
    // Literals are prefixed so a chunk id and a literal can never collide as
    // keys, and so a logged choice says which kind it was.
    ...(((frame.literal_fillers as string[] | null) ?? []).map((text) => ({
      key: `lit:${text}`,
      text,
      imageUrl: ((frame.filler_images as Record<string, string> | null) ?? {})[text] ?? null,
    }))),
  ];

  if (fillers.length === 0) return null;

  return {
    id: frame.id,
    pattern: frame.pattern,
    esPattern: frame.es_pattern,
    slot: frame.slot,
    fillers,
  };
}

/**
 * The formulation prompts for this session (`docs/ROADMAP.md` #1).
 *
 * Drawn from every chunk the learner has a card for -- met is the only
 * qualification, because a prompt for a phrase never shown is a quiz on
 * material the stage order exists to keep out. Seeded on the session so a
 * refresh deals the same hand. Reads only; the step writes nothing.
 */
export async function loadFormulationSet(userId: string): Promise<FormulationPrompt[]> {
  const supabase = await createClient();

  const [{ data: cards }, { count: completed }] = await Promise.all([
    supabase.from("user_cards").select("chunk_id").eq("user_id", userId),
    // Total finished sessions, across units: the hand rotates on this, so the
    // same five phrases hold for FORMULATION_HOLD_SESSIONS sessions running.
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);
  if (!cards?.length) return [];
  const seed = formulationSeed(completed ?? 0);

  const { data: chunks } = await supabase
    .from("chunks")
    .select("id, en_text, es_gloss, audio_urls")
    .in("id", cards.map((c) => c.chunk_id));

  const pool: FormulationPrompt[] = (chunks ?? []).map((c) => ({
    chunkId: c.id,
    es: c.es_gloss,
    en: c.en_text,
    audioUrl: ((c.audio_urls as { url: string }[] | null) ?? [])[0]?.url ?? null,
  }));
  return pickFormulation(pool, seed);
}
