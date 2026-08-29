import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TranscriptSegment } from "@/lib/supabase/types";
import type { AbsorbLine } from "./absorb";

/**
 * The listening library (`docs/ROADMAP.md` #4): every track the learner has
 * reached, grouped by unit, outside the daily loop.
 *
 * "Reached" means the unit is at or before his current one in curriculum
 * order. Tracks are built entirely from words those units taught, so nothing
 * here can be ahead of him -- and a track from a unit he has not started would
 * be the one thing in the library he could not follow, so it waits.
 *
 * Reads only. Nothing about listening is scored, counted, or written back;
 * the library exists to put more English in front of him, and the moment it
 * keeps score it becomes another exercise.
 */

export type ListeningTrackSummary = {
  id: string;
  titleEs: string;
  narrator: string;
  durationS: number | null;
};

export type ListeningUnit = {
  unitId: string;
  titleEs: string;
  tracks: ListeningTrackSummary[];
};

export type ListeningTrack = {
  id: string;
  titleEs: string;
  narrator: string;
  audioUrl: string | null;
  lines: AbsorbLine[];
};

/** Units at or before the learner's current one, in curriculum order. */
async function reachedUnitIds(currentUnit: string | null) {
  const supabase = await createClient();
  const { data: units } = await supabase
    .from("units")
    .select("id, block, order, title_es")
    .order("block")
    .order("order");
  const all = units ?? [];
  const at = all.findIndex((u) => u.id === currentUnit);
  return at === -1 ? all : all.slice(0, at + 1);
}

export async function loadListeningLibrary(currentUnit: string | null): Promise<ListeningUnit[]> {
  const supabase = await createClient();
  const reached = await reachedUnitIds(currentUnit);
  if (reached.length === 0) return [];

  const [{ data: tracks }, { data: characters }] = await Promise.all([
    supabase
      .from("scenes")
      .select("id, unit_id, title_es, character_id, duration_s")
      .eq("kind", "listening")
      .in(
        "unit_id",
        reached.map((u) => u.id),
      )
      .order("id"),
    supabase.from("characters").select("id, name"),
  ]);
  const names = new Map((characters ?? []).map((c) => [c.id, c.name]));

  return reached
    .map((unit) => ({
      unitId: unit.id,
      titleEs: unit.title_es,
      tracks: (tracks ?? [])
        .filter((t) => t.unit_id === unit.id)
        .map((t) => ({
          id: t.id,
          titleEs: t.title_es,
          narrator: names.get(t.character_id) ?? t.character_id,
          durationS: t.duration_s,
        })),
    }))
    .filter((u) => u.tracks.length > 0);
}

export async function loadListeningTrack(
  trackId: string,
  currentUnit: string | null,
): Promise<ListeningTrack | null> {
  const supabase = await createClient();
  const [{ data: scene }, { data: characters }, reached] = await Promise.all([
    supabase
      .from("scenes")
      .select("id, unit_id, title_es, character_id, audio_url, transcript")
      .eq("id", trackId)
      .eq("kind", "listening")
      .maybeSingle(),
    supabase.from("characters").select("id, name"),
    reachedUnitIds(currentUnit),
  ]);
  if (!scene) return null;
  // A track from a unit he has not reached is not an error, just not yet.
  if (!reached.some((u) => u.id === scene.unit_id)) return null;

  const names = new Map((characters ?? []).map((c) => [c.id, c.name]));
  const transcript = (scene.transcript as TranscriptSegment[] | null) ?? [];
  return {
    id: scene.id,
    titleEs: scene.title_es,
    narrator: names.get(scene.character_id) ?? scene.character_id,
    audioUrl: scene.audio_url,
    lines: transcript.map((line) => ({
      character: line.character,
      name: names.get(line.character) ?? line.character,
      en: line.en,
      es: line.es,
      startMs: line.start_ms,
      endMs: line.end_ms,
    })),
  };
}
