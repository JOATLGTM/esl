import "server-only";
import { createClient } from "@/lib/supabase/server";
import { shouldOfferMoreSupport } from "./progress";

/**
 * Whether to offer this learner more Spanish (PRD F2 / 4.6).
 *
 * `shouldOfferMoreSupport` has existed, tested, with no callers, since the day
 * it was written. This is the caller.
 *
 * The signal is `user_cards.gloss_reveals`, which Meet writes when the learner
 * taps to see the Spanish. That is the only signal there is: nobody reports
 * being lost, and a beginner who is struggling is precisely the person least
 * likely to say so. Someone reaching for the translation on most of their
 * cards is telling us something, and the reveal tap is how they tell us.
 *
 * Returns false at full support, because there is nothing to offer and asking
 * would imply there was.
 */
export async function shouldOfferSupport(userId: string, level: number): Promise<boolean> {
  if (level <= 1) return false;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_cards")
    .select("gloss_reveals")
    .eq("user_id", userId);

  if (!data?.length) return false;
  const revealed = data.filter((c) => c.gloss_reveals > 0).length;
  return shouldOfferMoreSupport(data.length, revealed, level);
}
