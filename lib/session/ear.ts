import "server-only";
import { buildDrill, foldDrillResults, type DrillItem, type MinimalPair } from "./drill";
import { createClient } from "@/lib/supabase/server";
import type { Contrast, PairAudio } from "@/lib/supabase/types";

/**
 * Stage 1, Ear: loading the drill and recording how it went.
 *
 * Nothing here can produce a drill today -- `minimal_pairs.audio` is empty for
 * every pair because the human recordings are a separate effort from the
 * authoring (PRD 8.1B). The stage is skipped rather than shown empty, and it
 * will light up on its own the moment the clips land, with no code change.
 */

export type EarDrill = { contrast: Contrast; explainEs: string; items: DrillItem[] };

export async function loadEarDrill(
  contrast: Contrast,
  budget: number,
  seed: string,
): Promise<EarDrill | null> {
  const supabase = await createClient();

  const [pairs, set] = await Promise.all([
    supabase
      .from("minimal_pairs")
      .select("id, word_a, word_b, ipa_a, ipa_b, audio")
      .eq("contrast", contrast)
      .order("id", { ascending: true }),
    supabase.from("contrast_sets").select("explain_es").eq("contrast", contrast).maybeSingle(),
  ]);

  const model: MinimalPair[] = (pairs.data ?? []).map((pair) => ({
    id: pair.id,
    wordA: pair.word_a,
    wordB: pair.word_b,
    ipaA: pair.ipa_a,
    ipaB: pair.ipa_b,
    audio: ((pair.audio as PairAudio[] | null) ?? []).map((clip) => ({
      speakerId: clip.speaker_id,
      word: clip.word,
      url: clip.url,
    })),
  }));

  const items = buildDrill(model, budget, seed);
  if (items.length === 0) return null;

  return { contrast, explainEs: set.data?.explain_es ?? "", items };
}

/**
 * Fold one drill's results into the learner's record for the contrast.
 *
 * Read-then-write because the retirement rule needs the trailing window, and
 * the window is an array Postgres cannot append-and-truncate in one expression
 * without a function. Two drills finishing at once is not a real race: a
 * session is one tab, and the loser would write a window one drill short.
 */
export async function recordDrillResults(
  userId: string,
  contrast: Contrast,
  results: boolean[],
): Promise<void> {
  if (results.length === 0) return;

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("user_contrast_stats")
    .select("attempts, correct, recent, retired_at")
    .eq("user_id", userId)
    .eq("contrast", contrast)
    .maybeSingle();

  const next = foldDrillResults(
    {
      attempts: existing?.attempts ?? 0,
      correct: existing?.correct ?? 0,
      recent: existing?.recent ?? [],
      retiredAt: existing?.retired_at ?? null,
    },
    results,
    now,
  );

  await supabase.from("user_contrast_stats").upsert(
    {
      user_id: userId,
      contrast,
      attempts: next.attempts,
      correct: next.correct,
      recent: next.recent,
      last_seen_at: now,
      retired_at: next.retiredAt,
    },
    { onConflict: "user_id,contrast" },
  );
}
