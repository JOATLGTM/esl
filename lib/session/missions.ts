import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

/**
 * Real-world missions (PRD F12).
 *
 * The learner does this outside the app, with an actual person, and then says
 * how it went. It is the only part of the product that cannot be completed by
 * tapping, and it is the part that decides whether someone becomes a speaker or
 * stays a studier.
 *
 * Three rules the code has to keep:
 *
 *   1. **A mission is never failed.** `mission_reports.attempted` exists to be
 *      reported on, never to gate. A learner who froze and said nothing still
 *      attempted, still reports, still gets the XP.
 *   2. **The alternative is first-class.** Someone with no English speakers near
 *      them is exactly who this course is for; `alternate_es` is required on
 *      every mission, and the UI offers it as an equal option rather than a
 *      consolation.
 *   3. **It is only offered when the learner can do it.** A mission whose
 *      preparation chunks have not been met is a request to improvise, which is
 *      the one thing a nervous beginner will not do.
 */

export type MissionRow = Tables<"missions">;

export type MissionView = {
  id: string;
  titleEs: string;
  instructionsEs: string;
  alternateEs: string;
  difficulty: number;
  /** True once the learner has reported back on it. */
  reported: boolean;
};

/**
 * The mission to offer, or null.
 *
 * The easiest unreported mission whose preparation the learner has actually
 * met. Easiest-first because the escalation *is* the pedagogy — one word to a
 * stranger has to come before a phone call, and a learner who is offered the
 * phone call first will simply not do either.
 */
export async function loadCurrentMission(
  userId: string,
  unitId: string | null,
): Promise<MissionView | null> {
  if (!unitId) return null;

  const supabase = await createClient();

  const [missions, reports, cards] = await Promise.all([
    supabase
      .from("missions")
      .select("id, title_es, instructions_es, alternate_es, difficulty, prep_chunk_ids")
      .eq("unit_id", unitId)
      .order("difficulty", { ascending: true }),
    supabase.from("mission_reports").select("mission_id").eq("user_id", userId),
    supabase.from("user_cards").select("chunk_id").eq("user_id", userId),
  ]);

  const reported = new Set((reports.data ?? []).map((r) => r.mission_id));
  const met = new Set((cards.data ?? []).map((c) => c.chunk_id));

  const ready = (missions.data ?? []).filter((mission) => {
    const prep = (mission.prep_chunk_ids as string[] | null) ?? [];
    return prep.every((chunkId) => met.has(chunkId));
  });

  const next = ready.find((mission) => !reported.has(mission.id));
  if (!next) return null;

  return {
    id: next.id,
    titleEs: next.title_es,
    instructionsEs: next.instructions_es,
    alternateEs: next.alternate_es ?? "",
    difficulty: next.difficulty,
    reported: false,
  };
}

/**
 * File a report on a mission.
 *
 * Every field is optional except the fact that it happened. A learner who does
 * not want to say how it felt should not be blocked from recording that they
 * did it, and `attempted` is always true — there is no path here that records a
 * failure, because there is no such thing.
 */
export async function recordMissionReport(
  userId: string,
  missionId: string,
  difficultyFelt: number | null,
  wasUnderstood: "yes" | "partly" | "no" | null,
): Promise<void> {
  const supabase = await createClient();

  // The mission has to exist and belong to a real unit; a forged id would fail
  // the foreign key anyway, but failing here keeps the error legible.
  const { data: mission } = await supabase
    .from("missions")
    .select("id")
    .eq("id", missionId)
    .maybeSingle();
  if (!mission) return;

  // One report per (user, mission), enforced by `mission_reports_once`: the
  // count on /home is presented as people spoken to, and a double-tap must
  // file nothing rather than inflate it. ignoreDuplicates so the second tap
  // also fails nothing.
  await supabase.from("mission_reports").upsert(
    {
      user_id: userId,
      mission_id: missionId,
      difficulty_felt: difficultyFelt,
      was_understood: wasUnderstood,
      attempted: true,
    },
    { onConflict: "user_id,mission_id", ignoreDuplicates: true },
  );
}
