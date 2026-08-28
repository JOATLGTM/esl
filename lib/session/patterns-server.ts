import "server-only";
import { summarisePatterns, type ErrorEvent } from "./patterns";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether the learner has a pattern worth telling them about.
 *
 * Split from the page so `/home` can decide whether to offer the link without
 * rendering it. Offering a link to "algo que se te repite" and then showing an
 * empty page would be a small cruelty: the learner clicks expecting to be told
 * something and is told nothing.
 */
export async function hasPatternsToShow(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("error_events")
    .select("error_type, user_text, corrected_text")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  const events: ErrorEvent[] = (data ?? []).map((row) => ({
    errorType: row.error_type,
    userText: row.user_text,
    correctedText: row.corrected_text,
  }));
  return summarisePatterns(events).length > 0;
}
