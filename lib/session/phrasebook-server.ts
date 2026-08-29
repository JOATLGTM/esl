import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChunkAudio } from "@/lib/supabase/types";
import { groupPhrases, type Phrase, type PhraseGroup } from "./phrasebook";

/**
 * Every chunk the learner has a card for -- met is the only qualification --
 * with its gloss and one voice. Reads only; the phrasebook writes nothing,
 * because a shelf that keeps score is a test.
 */
export async function loadPhrasebook(userId: string): Promise<PhraseGroup[]> {
  const supabase = await createClient();

  const { data: cards } = await supabase.from("user_cards").select("chunk_id").eq("user_id", userId);
  if (!cards?.length) return [];

  const { data: chunks } = await supabase
    .from("chunks")
    .select("id, en_text, es_gloss, audio_urls, tags")
    .in(
      "id",
      cards.map((c) => c.chunk_id),
    );

  const phrases: Phrase[] = (chunks ?? []).map((c) => ({
    id: c.id,
    en: c.en_text,
    es: c.es_gloss,
    audioUrl: ((c.audio_urls as ChunkAudio[] | null) ?? [])[0]?.url ?? null,
    tags: (c.tags as string[] | null) ?? [],
  }));
  return groupPhrases(phrases);
}
