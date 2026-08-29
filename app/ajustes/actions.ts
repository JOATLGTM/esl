"use server";

import { z } from "zod";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { L1_CHOICES } from "@/lib/session/l1";

/**
 * The learner changing their own settings.
 *
 * Both fields already existed and neither could be changed after onboarding:
 * `daily_goal_minutes` was chosen once on screen 2 and then fixed forever, and
 * `l1_support_level` was written by the curriculum and read by nothing. A
 * course whose whole subject is a person gaining control over something should
 * probably let them change the amount of help they get.
 *
 * Validated against the same values the database constrains, so a tampered
 * payload is rejected here rather than by a CHECK the learner would see as a
 * crash.
 */
const settings = z.object({
  l1_support_level: z.coerce
    .number()
    .int()
    .refine((n) => (L1_CHOICES as readonly number[]).includes(n)),
  daily_goal_minutes: z.coerce.number().int().refine((n) => [10, 20, 30].includes(n)),
});

export async function saveSettings(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = settings.safeParse({
    l1_support_level: formData.get("l1_support_level"),
    daily_goal_minutes: formData.get("daily_goal_minutes"),
  });
  // A bad payload is not a thing to explain to a beginner; the form only ever
  // sends valid values, so this is tamper-handling, not a user path.
  if (!parsed.success) return;

  const supabase = await createClient();
  await supabase
    .from("users")
    .update({
      l1_support_level: parsed.data.l1_support_level,
      daily_goal_minutes: parsed.data.daily_goal_minutes,
    })
    .eq("id", user.id);

  refresh();
}

/**
 * Accepting the offer of more Spanish (PRD F2).
 *
 * One step, not a reset, and only ever on the learner pressing yes.
 * `shouldOfferMoreSupport` decides when to ask; this is what happens after.
 */
export async function acceptMoreSupport(level: number) {
  const user = await getUser();
  if (!user) redirect("/login");

  const next = Math.max(1, Math.min(5, Math.round(level) - 1));
  const supabase = await createClient();
  await supabase.from("users").update({ l1_support_level: next }).eq("id", user.id);
  refresh();
}
