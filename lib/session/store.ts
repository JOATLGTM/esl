import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Contrast, PairAudio, Tables } from "@/lib/supabase/types";
import type { Stage, StageInventory } from "./stages";

/**
 * Reading and opening sessions.
 *
 * Both the page and the advance action need the same two things -- what this
 * unit can serve, and which session row we are in -- and they must agree. A
 * page that offers a stage the action then refuses to advance past is a hang
 * with no error message, so the answer comes from one place.
 */

export type SessionRow = Tables<"sessions">;
export type SessionUnit = Pick<Tables<"units">, "id" | "title_es" | "title_en"> & {
  target_contrast: Contrast;
};

/** The unit, or null if the id in the URL is not one. */
export async function loadUnit(unitId: string): Promise<SessionUnit | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("units")
    .select("id, title_es, title_en, target_contrast")
    .eq("id", unitId)
    .maybeSingle();
  return data ?? null;
}

/**
 * What this unit can serve this learner today. See `availableStages`.
 *
 * Takes the learner because one of the five stages is exhaustible: Meet
 * introduces chunks, and a unit whose chunks have all been met has no Meet
 * left in it.
 */
export async function loadStageInventory(
  userId: string,
  unit: SessionUnit,
): Promise<StageInventory> {
  const supabase = await createClient();

  const [chunks, scenes, speakingTasks, pairs, met] = await Promise.all([
    supabase.from("chunks").select("id", { count: "exact", head: true }).eq("unit_id", unit.id),
    supabase.from("scenes").select("id", { count: "exact", head: true }).eq("unit_id", unit.id),
    supabase.from("dialogues").select("id", { count: "exact", head: true }).eq("unit_id", unit.id),
    // Counted, not just "does a pair row exist": all 25 pairs for `ee_ih` are
    // seeded with an empty `audio` array, because the human recordings are a
    // separate drive from the authoring. A pair with no takes teaches nothing.
    supabase.from("minimal_pairs").select("audio").eq("contrast", unit.target_contrast),
    // Row-level security already scopes this to the caller; the explicit filter
    // is what makes that visible at the call site rather than two files away.
    supabase.from("user_cards").select("chunk_id").eq("user_id", userId),
  ]);

  const earClips = (pairs.data ?? []).reduce(
    (total, pair) => total + ((pair.audio as PairAudio[] | null)?.length ?? 0),
    0,
  );

  // Cards are keyed by chunk, not by unit, so this counts the learner's cards
  // across the whole course and intersects. At a few thousand chunks that is
  // still one small query; if it ever is not, the fix is a join, not a cache.
  const metChunkIds = new Set((met.data ?? []).map((card) => card.chunk_id));
  const unitChunkIds = await loadUnitChunkIds(unit.id);

  return {
    earClips,
    chunks: chunks.count ?? 0,
    newChunks: unitChunkIds.filter((id) => !metChunkIds.has(id)).length,
    scenes: scenes.count ?? 0,
    speakingTasks: speakingTasks.count ?? 0,
  };
}

/** Every chunk id in a unit, in curriculum order. */
async function loadUnitChunkIds(unitId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chunks")
    .select("id")
    .eq("unit_id", unitId)
    .order("id", { ascending: true });
  return (data ?? []).map((chunk) => chunk.id);
}

/**
 * The learner's session for this unit: the unfinished one if there is one,
 * otherwise a new one.
 *
 * Resuming an old unfinished session rather than starting a fresh row is what
 * makes "you can close the app mid-session" true (PRD 4.2), and it keeps the
 * table from filling with abandoned stubs that would each look like a practice
 * day to anything counting rows later.
 */
export async function openSession(
  userId: string,
  unitId: string,
  startAt: Stage,
): Promise<SessionRow> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("unit_id", unitId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("sessions")
    .insert({ user_id: userId, unit_id: unitId, stage_reached: startAt })
    .select("*")
    .single();

  if (created) return created;

  // `sessions_one_open_per_unit` rejected it, which means a concurrent request
  // -- a prefetch racing the navigation that follows it -- inserted between our
  // select and our insert. The other request won and its row is the session;
  // read it back rather than failing a page load over a race we asked the
  // database to settle. 23505 is unique_violation.
  if (error?.code === "23505") {
    const { data: theirs } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .eq("unit_id", unitId)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (theirs) return theirs;
  }

  // Anything else is the database being unreachable rather than a permission
  // problem -- row-level security scopes this insert to the caller. Let it
  // surface: silently rendering a session that was never recorded would lose
  // the learner's progress at the first advance.
  throw new Error(`Could not start a session for ${unitId}: ${error?.message ?? "no row returned"}`);
}
