import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * How many times the learner has spoken English to a real person
 * (`docs/ROADMAP.md` #9).
 *
 * Missions are the only part of the product with real transfer, and until
 * this they were the least instrumented: offered once, inside a flow, nothing
 * accumulated. *"Has hablado inglés con 7 personas"* on `/home` is a stronger
 * reason to come back than a streak, and it reframes progress as the thing
 * the product claims to teach rather than minutes on a screen.
 *
 * Counts reports, not successes -- a mission is never failed (PRD F12), and
 * `attempted` is always true. Someone who walked up to a stranger and got
 * nothing back still spoke English to a person.
 */
export async function countPeopleSpokenTo(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("mission_reports")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("attempted", true);
  return count ?? 0;
}
