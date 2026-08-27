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

/** What this unit can actually serve today. See `availableStages`. */
export async function loadStageInventory(unit: SessionUnit): Promise<StageInventory> {
  const supabase = await createClient();

  const [chunks, scenes, speakingTasks, pairs] = await Promise.all([
    supabase.from("chunks").select("id", { count: "exact", head: true }).eq("unit_id", unit.id),
    supabase.from("scenes").select("id", { count: "exact", head: true }).eq("unit_id", unit.id),
    supabase.from("dialogues").select("id", { count: "exact", head: true }).eq("unit_id", unit.id),
    // Counted, not just "does a pair row exist": all 25 pairs for `ee_ih` are
    // seeded with an empty `audio` array, because the human recordings are a
    // separate drive from the authoring. A pair with no takes teaches nothing.
    supabase.from("minimal_pairs").select("audio").eq("contrast", unit.target_contrast),
  ]);

  const earClips = (pairs.data ?? []).reduce(
    (total, pair) => total + ((pair.audio as PairAudio[] | null)?.length ?? 0),
    0,
  );

  return {
    earClips,
    chunks: chunks.count ?? 0,
    scenes: scenes.count ?? 0,
    speakingTasks: speakingTasks.count ?? 0,
  };
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

  // Row-level security scopes this insert to the caller, so a failure here is
  // the database being unreachable rather than a permission problem. Let it
  // surface: silently rendering a session that was never recorded would lose
  // the learner's progress at the first advance.
  if (error || !created) {
    throw new Error(`Could not start a session for ${unitId}: ${error?.message ?? "no row returned"}`);
  }
  return created;
}
