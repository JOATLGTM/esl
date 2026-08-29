import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChunkAudio } from "@/lib/supabase/types";

/**
 * Every audio URL a unit can play -- chunk voices, example clips, scene and
 * listening tracks -- so the service worker can pull the whole unit at once.
 * Public content, public-read; nothing here is about the learner.
 */
export async function loadUnitAudioUrls(unitId: string | null): Promise<string[]> {
  if (!unitId) return [];
  const supabase = await createClient();
  const [{ data: chunks }, { data: scenes }] = await Promise.all([
    supabase.from("chunks").select("audio_urls").eq("unit_id", unitId),
    supabase.from("scenes").select("audio_url").eq("unit_id", unitId),
  ]);
  const urls = new Set<string>();
  for (const c of chunks ?? []) for (const a of (c.audio_urls as ChunkAudio[] | null) ?? []) urls.add(a.url);
  for (const s of scenes ?? []) if (s.audio_url) urls.add(s.audio_url);
  return [...urls];
}
