import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChunkAudio, Tables } from "@/lib/supabase/types";

/**
 * Stage 2, Meet (PRD 4.2): the chunks a learner sees for the first time.
 *
 * Two rules shape everything here.
 *
 * **A chunk is met once.** Which chunks are new is derived from the absence of
 * a `user_cards` row, not from a cursor on the session or the profile. That
 * means an abandoned session introduces nothing, a resumed one picks up the
 * same chunks it was showing, and there is no counter to drift out of sync
 * with what the learner has actually seen.
 *
 * **The page and the action must agree on which chunks those are.** Both call
 * `loadMeetChunks` with the same budget and get the same rows in the same
 * order, so the action can record what the page showed without the client
 * being trusted to say. The client is trusted for exactly one thing -- which
 * glosses were revealed -- and that is checked against this list.
 */

/** A chunk as Meet needs it: the phrase, its gloss, an example, and voices. */
export type MeetChunk = {
  id: string;
  en: string;
  es: string;
  exampleEn: string;
  exampleEs: string;
  /** A picture of the referent, when one exists. The taper's terminus. */
  imageUrl: string | null;
  /** At least two, by PRD F2 -- a card that cannot be heard in two voices is not a card. */
  voices: ChunkAudio[];
};

type ChunkRow = Pick<
  Tables<"chunks">,
  "id" | "en_text" | "es_gloss" | "example_en" | "example_es" | "audio_urls" | "image_url"
>;

function toMeetChunk(row: ChunkRow): MeetChunk {
  return {
    id: row.id,
    en: row.en_text,
    es: row.es_gloss,
    exampleEn: row.example_en,
    exampleEs: row.example_es,
    imageUrl: row.image_url,
    voices: (row.audio_urls as ChunkAudio[] | null) ?? [],
  };
}

/**
 * The next `budget` chunks in this unit the learner has not met, in curriculum
 * order.
 *
 * Two queries and an intersection rather than one clever one: PostgREST has no
 * `not in (subquery)`, and a unit is 25 rows, so the alternative is a database
 * function to save a round trip nobody will notice.
 */
export async function loadMeetChunks(
  userId: string,
  unitId: string,
  budget: number,
): Promise<MeetChunk[]> {
  const supabase = await createClient();

  const [chunks, met] = await Promise.all([
    supabase
      .from("chunks")
      .select("id, en_text, es_gloss, example_en, example_es, audio_urls, image_url")
      .eq("unit_id", unitId)
      .order("id", { ascending: true }),
    supabase.from("user_cards").select("chunk_id").eq("user_id", userId),
  ]);

  const metChunkIds = new Set((met.data ?? []).map((card) => card.chunk_id));

  return (chunks.data ?? [])
    .filter((chunk) => !metChunkIds.has(chunk.id))
    .slice(0, budget)
    .map(toMeetChunk);
}

/**
 * Turn the chunks Meet just showed into cards.
 *
 * Called when the learner leaves the stage, not when they arrive: a session
 * abandoned halfway through Meet should leave the learner exactly where they
 * were, with those chunks still new. It is also the only write, so a stage that
 * is opened and closed ten times costs ten reads and no rows.
 *
 * `ignoreDuplicates` rather than a plain upsert, and that matters: an upsert
 * would rewrite `gloss_reveals` and `state` on a card that already exists,
 * silently undoing review history if this ever runs twice. Here a second run is
 * a no-op.
 *
 * `state: 'learning'` rather than the `'new'` default because the learner has
 * now actually seen the phrase. It is the product's notion of maturity, not the
 * scheduler's -- FSRS keeps its own state in `fsrs_state`, and Retrieve owns
 * that. Nothing here may write `'learned'`: the database refuses it until two
 * production passes exist.
 */
export async function recordMeetChunks(
  userId: string,
  chunks: MeetChunk[],
  revealedChunkIds: string[],
): Promise<void> {
  if (chunks.length === 0) return;

  // The client says which glosses it revealed. Anything not in the list of
  // chunks this stage actually served is discarded rather than trusted.
  const shown = new Set(chunks.map((chunk) => chunk.id));
  const revealed = new Set(revealedChunkIds.filter((id) => shown.has(id)));

  const supabase = await createClient();
  await supabase.from("user_cards").upsert(
    chunks.map((chunk) => ({
      user_id: userId,
      chunk_id: chunk.id,
      state: "learning" as const,
      gloss_reveals: revealed.has(chunk.id) ? 1 : 0,
    })),
    { onConflict: "user_id,chunk_id", ignoreDuplicates: true },
  );
}
