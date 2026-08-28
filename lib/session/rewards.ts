import "server-only";
import { localDate } from "./day";
import { dailyQuestPlan, questProgress, xpForSession, type QuestType } from "./quests";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

/**
 * Writing XP and quest progress (PRD F8).
 *
 * Everything here is additive. There is no path that lowers `total_xp`, resets
 * `days_practiced`, or marks a quest failed — a quest the learner did not
 * finish simply ends the day unfinished and is replaced tomorrow, with no
 * notification and no loss animation.
 */

export type QuestRow = Tables<"daily_quests">;

/**
 * The learner's quests for today, created on first sight.
 *
 * Generated lazily rather than by a scheduled job: this product has no cron and
 * should not need one, and a learner who does not open the app on Tuesday
 * should not accumulate a Tuesday's worth of unfinished quests to find on
 * Wednesday.
 *
 * `ignoreDuplicates` because two requests on the same morning race here — the
 * `(user_id, quest_date, quest_type)` unique key settles it and the loser reads
 * back what the winner wrote.
 */
export async function ensureDailyQuests(
  userId: string,
  timezone: string,
  dailyGoalMinutes: number,
): Promise<QuestRow[]> {
  const supabase = await createClient();
  const today = localDate(timezone);

  const plan = dailyQuestPlan(`${userId}:${today}`, dailyGoalMinutes);

  await supabase.from("daily_quests").upsert(
    plan.map((quest) => ({
      user_id: userId,
      quest_date: today,
      quest_type: quest.type,
      is_speaking: quest.isSpeaking,
      target: quest.target,
    })),
    { onConflict: "user_id,quest_date,quest_type", ignoreDuplicates: true },
  );

  const { data } = await supabase
    .from("daily_quests")
    .select("*")
    .eq("user_id", userId)
    .eq("quest_date", today);

  // Returned in plan order rather than insertion order, so the speaking quest
  // is always first on the page.
  const byType = new Map((data ?? []).map((row) => [row.quest_type, row]));
  return plan.flatMap((quest) => {
    const row = byType.get(quest.type);
    return row ? [row] : [];
  });
}

/**
 * Move a quest along, if the learner happens to have it today.
 *
 * Silently does nothing when today's plan does not include the quest — the
 * caller is a stage that just finished and should not have to know which three
 * quests were drawn this morning.
 */
export async function bumpQuest(
  userId: string,
  timezone: string,
  type: QuestType,
  by = 1,
): Promise<void> {
  if (by <= 0) return;

  const supabase = await createClient();
  const today = localDate(timezone);

  const { data: quest } = await supabase
    .from("daily_quests")
    .select("id, target, progress, completed")
    .eq("user_id", userId)
    .eq("quest_date", today)
    .eq("quest_type", type)
    .maybeSingle();

  if (!quest || quest.completed) return;

  const progress = questProgress(quest.progress, quest.target, by);
  await supabase
    .from("daily_quests")
    .update({ progress, completed: progress >= quest.target })
    .eq("id", quest.id);
}

/**
 * Award a finished session's XP.
 *
 * Read-then-write on `total_xp` rather than a SQL increment because the session
 * row has to be stamped with the same number — `sessions.xp_earned` is what
 * makes a day's total explainable later, and a bare increment would leave the
 * two able to disagree.
 */
export async function awardSessionXp(
  userId: string,
  sessionId: string,
  stagesCompleted: number,
  speakingTasks: number,
): Promise<number> {
  const xp = xpForSession({ stagesCompleted, speakingTasks });
  if (xp <= 0) return 0;

  const supabase = await createClient();

  await supabase.from("sessions").update({ xp_earned: xp }).eq("id", sessionId).eq("user_id", userId);

  const { data: profile } = await supabase
    .from("users")
    .select("total_xp")
    .eq("id", userId)
    .maybeSingle();

  if (profile) {
    await supabase
      .from("users")
      .update({ total_xp: profile.total_xp + xp })
      .eq("id", userId);
  }

  return xp;
}
