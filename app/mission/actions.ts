"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { recordMissionReport } from "@/lib/session/missions";
import { getUser } from "@/lib/supabase/server";

/**
 * Report back on a mission (PRD F12).
 *
 * There is deliberately no "I failed" branch. `attempted` is always true, the
 * two feelings questions are both optional, and nothing here decides whether
 * the mission counted -- it did.
 */
const report = z.object({
  missionId: z.string().min(1).max(64),
  /** 😰 😐 🙂, or nothing if the learner would rather not say. */
  difficultyFelt: z.coerce.number().int().min(1).max(3).nullable().catch(null),
  wasUnderstood: z.enum(["yes", "partly", "no"]).nullable().catch(null),
});

export async function reportMission(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = report.safeParse({
    missionId: formData.get("missionId"),
    difficultyFelt: formData.get("difficultyFelt") || null,
    wasUnderstood: formData.get("wasUnderstood") || null,
  });

  // A tampered payload is not worth an error screen on a page whose whole job
  // is to be gentle. Send them back to the mission.
  if (!parsed.success) redirect("/mission");

  await recordMissionReport(
    user.id,
    parsed.data.missionId,
    parsed.data.difficultyFelt,
    parsed.data.wasUnderstood,
  );

  redirect("/mission?done=1");
}
