import "server-only";
import { newlyEarned, type AchievementKey } from "./achievements";
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

/**
 * Record the words a chunk taught (PRD F9's 95% rule, at runtime).
 *
 * `known_words` is what lets a later unit be checked against what this learner
 * actually knows rather than against the curriculum's idea of it. The content
 * pipeline computes the same thing statically at authoring time; this is the
 * per-learner counterpart.
 *
 * `ignoreDuplicates` because a word is known once — the first chunk that taught
 * it owns the row, and re-meeting it must not move the date.
 */
export async function recordKnownWords(userId: string, texts: string[]): Promise<void> {
  const words = new Set(
    texts
      .flatMap((text) => text.toLowerCase().match(/[\p{L}']+/gu) ?? [])
      // Leading/trailing apostrophes come from possessives and quotes; the
      // internal ones in "what's" are part of the word.
      .map((word) => word.replace(/^'+|'+$/g, ""))
      .filter(Boolean),
  );
  if (words.size === 0) return;

  const supabase = await createClient();
  await supabase.from("known_words").upsert(
    [...words].map((word) => ({ user_id: userId, word, source: "card" })),
    { onConflict: "user_id,word", ignoreDuplicates: true },
  );
}

/**
 * Award any achievements the learner now qualifies for.
 *
 * Recomputed in full rather than driven by events: it is cheap, idempotent, and
 * a learner who qualified while a bug was swallowing the event still gets the
 * row the next time they finish a session. Returns the newly earned keys so the
 * caller can decide whether to say anything.
 */
export async function awardAchievements(userId: string): Promise<AchievementKey[]> {
  const supabase = await createClient();

  const [profile, held, cards, speaking, sessions] = await Promise.all([
    supabase.from("users").select("days_practiced, current_unit").eq("id", userId).maybeSingle(),
    supabase.from("achievements").select("achievement_key").eq("user_id", userId),
    supabase.from("user_cards").select("state").eq("user_id", userId),
    supabase.from("sessions").select("speaking_tasks_completed").eq("user_id", userId),
    supabase
      .from("sessions")
      .select("unit_id")
      .eq("user_id", userId)
      .not("completed_at", "is", null),
  ]);

  const completedUnits = new Set((sessions.data ?? []).map((s) => s.unit_id));
  // Units the learner has moved *past*, which is one fewer than the units they
  // have practised in -- the current one is not finished by being started.
  const unitsFinished = Math.max(0, completedUnits.size - 1);

  const fresh = newlyEarned(
    {
      daysPracticed: profile.data?.days_practiced ?? 0,
      speakingTasksTotal: (speaking.data ?? []).reduce((n, s) => n + s.speaking_tasks_completed, 0),
      // One completed session is one scene heard, which is what Absorb serves.
      scenesHeard: (sessions.data ?? []).length,
      chunksMet: (cards.data ?? []).length,
      cardsLearned: (cards.data ?? []).filter((c) => c.state === "learned").length,
      unitsFinished,
    },
    (held.data ?? []).map((row) => row.achievement_key),
  );

  if (fresh.length === 0) return [];

  await supabase.from("achievements").upsert(
    fresh.map((key) => ({ user_id: userId, achievement_key: key })),
    { onConflict: "user_id,achievement_key", ignoreDuplicates: true },
  );

  return fresh;
}
