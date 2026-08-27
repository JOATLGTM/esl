"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, getUser } from "@/lib/supabase/server";

/**
 * Finish onboarding (PRD F1).
 *
 * One write at the end, not one per step. The five screens are answered
 * entirely client-side and submitted together, which is most of how the flow
 * stays inside its 90-second budget -- five round trips on mobile data is
 * roughly fifteen seconds of staring at a spinner.
 *
 * Nothing here is trusted from the client beyond these four values, and the
 * update is scoped to the caller's own row. Row-level security would reject
 * anything else anyway; the `.eq('id', user.id)` is belt to that braces.
 */
const answers = z.object({
  motivation: z.enum(["work", "travel", "family", "study", "other"]),
  daily_goal_minutes: z.coerce.number().int().refine((n) => [10, 20, 30].includes(n)),
  mic_permission: z.enum(["granted", "denied", "unsupported", "skipped"]),
  start_unit: z.string().min(1),
});

export async function completeOnboarding(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");

  const parsed = answers.safeParse({
    motivation: formData.get("motivation"),
    daily_goal_minutes: formData.get("daily_goal_minutes"),
    mic_permission: formData.get("mic_permission"),
    start_unit: formData.get("start_unit"),
  });

  // The client cannot reach the finish button without answering, so a failure
  // here is a tampered payload rather than a person. Send them back through.
  if (!parsed.success) redirect("/onboarding");

  const supabase = await createClient();
  const { error } = await supabase
    .from("users")
    .update({
      motivation: parsed.data.motivation,
      daily_goal_minutes: parsed.data.daily_goal_minutes,
      mic_permission: parsed.data.mic_permission,
      current_unit: parsed.data.start_unit,
      onboarded_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) redirect("/onboarding?error=1");

  redirect("/home");
}
