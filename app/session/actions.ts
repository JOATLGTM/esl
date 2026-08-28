"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { localDate, practiceCounters } from "@/lib/session/day";
import { loadMeetChunks, recordMeetChunks } from "@/lib/session/meet";
import { recordDrillResults } from "@/lib/session/ear";
import { applyReview } from "@/lib/session/retrieve";
import { recordSpeakingTask, weekNumber } from "@/lib/session/speak";
import {
  STAGE_ORDER,
  availableStages,
  newChunkBudget,
  nextStage,
  resumeAt,
} from "@/lib/session/stages";
import { loadStageInventory, loadUnit } from "@/lib/session/store";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Moving through a session (PRD 4.2).
 *
 * One action for all five stages. The client says which stage it thinks it is
 * finishing; the server decides what comes next, from the same inventory the
 * page used to decide what to render. The client never names its destination,
 * so a tampered payload cannot skip a stage -- it can only claim to have
 * finished one it is not on, which is checked below and ignored.
 *
 * Every advance is a write. That is the whole point: `stage_reached` is what a
 * resumed session opens at, and a session that only saves at the end is not
 * resumable, it is just short.
 */

/**
 * An hour on one stage is already far past anything real, so beyond it the
 * number is either a tab left open overnight or someone editing the payload.
 * Clamped rather than rejected -- refusing the advance would strand a learner
 * who genuinely walked away mid-stage.
 */
const MAX_STAGE_SECONDS = 3600;

const advance = z.object({
  sessionId: z.string().uuid(),
  from: z.enum(STAGE_ORDER),
  elapsedS: z.number().finite().nonnegative().catch(0),
  /**
   * Meet only: the chunks whose Spanish gloss the learner tapped to reveal.
   *
   * The one thing the client is trusted for, because it is the only party that
   * knows. It is still not trusted blindly -- `recordMeetChunks` discards any
   * id that is not in the list of chunks the stage actually served, so the
   * worst a tampered payload can do is mark the learner's own cards revealed.
   */
  revealedChunkIds: z.array(z.string()).max(64).optional(),
});

export type AdvanceInput = z.input<typeof advance>;

/**
 * One review, recorded as it happens (PRD F2).
 *
 * Separate from `advanceStage` and called per card rather than batched at the
 * end of the stage, because in a spaced-repetition system the review history is
 * the product. A learner who closes the tab after eight of twelve cards keeps
 * eight reviews.
 *
 * The client sends what happened, not what to schedule: the outcome is one of
 * three words and the server decides the rating, the interval and whether the
 * card matured. A tampered payload can therefore misreport one answer -- about
 * the learner's own card -- and cannot invent a mastery it did not earn, which
 * the database refuses independently.
 */
const review = z.object({
  chunkId: z.string().min(1).max(64),
  mode: z.enum(["recognize", "produce_typed", "produce_spoken"]),
  outcome: z.enum(["correct", "close", "wrong"]),
});

export async function reviewCard(input: z.input<typeof review>) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = review.safeParse(input);
  if (!parsed.success) return;

  await applyReview(user.id, parsed.data.chunkId, parsed.data.mode, parsed.data.outcome);
}

/**
 * Note a speaking recording the learner chose to keep (PRD F5).
 *
 * The audio itself goes straight from the browser to Storage, never through
 * here: a Server Action body is capped at 1 MB by default and a minute of
 * `MediaRecorder` webm can exceed it, so routing it through the server would
 * fail for exactly the learners who talked the longest.
 *
 * `recording_path` is checked against the caller rather than trusted. Storage
 * policies key on the first path segment being the owner's uuid, so a forged
 * path could not have been written to anyway -- but a row pointing at someone
 * else's object has no business existing either.
 */
const sample = z.object({
  path: z.string().min(1).max(512),
  durationS: z.number().int().nonnegative().max(600).catch(0),
  promptId: z.string().min(1).max(64),
  promptEs: z.string().min(1).max(500),
});

export async function recordSpeakingSample(input: z.input<typeof sample>) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = sample.safeParse(input);
  if (!parsed.success) return;
  if (!parsed.data.path.startsWith(`${user.id}/`)) return;

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("created_at")
    .eq("id", user.id)
    .maybeSingle();

  await supabase.from("speaking_samples").insert({
    user_id: user.id,
    prompt_id: parsed.data.promptId,
    prompt_es: parsed.data.promptEs,
    recording_path: parsed.data.path,
    duration_s: parsed.data.durationS,
    week_number: weekNumber(profile?.created_at ?? new Date().toISOString()),
  });
}

/**
 * Fold one ear-training drill into the learner's record for the contrast.
 *
 * The client sends only which items were right, never the accuracy or the
 * retirement decision -- both are the server's, because retiring a contrast
 * stops showing it and that is not a call a browser gets to make.
 */
const drill = z.object({
  contrast: z.enum([
    "ee_ih",
    "schwa",
    "final_clusters",
    "b_v",
    "s_onset",
    "aspiration",
    "th",
    "h_r",
    "stress_intonation",
  ]),
  results: z.array(z.boolean()).max(64),
});

export async function recordDrill(input: z.input<typeof drill>) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = drill.safeParse(input);
  if (!parsed.success) return;

  await recordDrillResults(user.id, parsed.data.contrast, parsed.data.results);
}

export async function advanceStage(input: AdvanceInput) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = advance.safeParse(input);
  if (!parsed.success) redirect("/home");

  const supabase = await createClient();

  // Row-level security already scopes this to the caller; the explicit
  // `user_id` filter means a mismatched id reads as "no such session" here
  // rather than as an empty result somewhere further down.
  const { data: session } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", parsed.data.sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session || session.completed_at) redirect("/home");

  const unit = await loadUnit(session.unit_id);
  if (!unit) redirect("/home");

  const available = availableStages(await loadStageInventory(user.id, unit));
  const current = resumeAt(session.stage_reached, available);

  // A double-tap, a back button, or a stale tab: the session has already moved
  // past the stage this request is finishing. Re-render and let the page show
  // where the learner actually is. Not an error -- nothing was lost.
  if (!current || current !== parsed.data.from) {
    refresh();
    return;
  }

  // Whatever the stage produced, written before the session moves past it. A
  // crash between here and the update below costs the learner one stage's
  // progress marker, not the work they did in it.
  if (current === "meet") {
    const { data: profile } = await supabase
      .from("users")
      .select("daily_goal_minutes")
      .eq("id", user.id)
      .maybeSingle();

    const shown = await loadMeetChunks(
      user.id,
      unit.id,
      newChunkBudget(profile?.daily_goal_minutes ?? 20),
    );
    await recordMeetChunks(user.id, shown, parsed.data.revealedChunkIds ?? []);
  }

  // PRD 3's counter-metric, incremented from the server on the strength of
  // finishing the script rather than from a self-report -- and never gated on
  // the microphone, which is optional forever.
  if (current === "speak") {
    await recordSpeakingTask(session.id, user.id);
  }

  const elapsed = Math.min(Math.round(parsed.data.elapsedS), MAX_STAGE_SECONDS);
  const duration_s = session.duration_s + elapsed;
  const next = nextStage(current, available);

  if (next) {
    await supabase
      .from("sessions")
      .update({ stage_reached: next, duration_s })
      .eq("id", session.id);
    refresh();
    return;
  }

  await supabase
    .from("sessions")
    .update({ duration_s, completed_at: new Date().toISOString() })
    .eq("id", session.id);

  await recordPractice(user.id);
  redirect("/home");
}

/**
 * Credit the day (PRD F8).
 *
 * Read-then-write rather than a SQL increment because the streak rule needs the
 * previous date to decide whether the run continues. Two sessions finished the
 * same day race here, and the loser writes the same values the winner did --
 * `practiceCounters` returns null once the day is already credited, so a second
 * session cannot inflate the count.
 *
 * XP and the three daily quests are deliberately not here. They arrive with F8
 * proper; counting the day is what /home already promises to show.
 */
async function recordPractice(userId: string) {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("users")
    .select("timezone, days_practiced, current_consecutive_days, last_practiced_on")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return;

  const counters = practiceCounters(
    {
      daysPracticed: profile.days_practiced,
      consecutiveDays: profile.current_consecutive_days,
      lastPracticedOn: profile.last_practiced_on,
    },
    localDate(profile.timezone),
  );

  if (!counters) return;

  await supabase
    .from("users")
    .update({
      days_practiced: counters.daysPracticed,
      current_consecutive_days: counters.consecutiveDays,
      last_practiced_on: counters.lastPracticedOn,
    })
    .eq("id", userId);
}
