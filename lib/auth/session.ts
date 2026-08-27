import "server-only";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/types";

/**
 * Route guards.
 *
 * These are convenience, not security. The security boundary is row-level
 * security in Postgres -- a learner who bypasses every redirect in this file
 * still cannot read a row that is not theirs. That separation matters: it means
 * a bug here is a navigation annoyance, never a data leak.
 *
 * The onboarding check lives here rather than in proxy.ts on purpose. The proxy
 * runs on every request and is meant to be lightweight enough to sit on a CDN;
 * putting a database round trip in it would tax every asset request to catch a
 * state that only matters on a handful of pages.
 */

export type Profile = Tables<"users">;

/** The signed-in learner's profile, or a redirect to login. */
export async function requireProfile(): Promise<Profile> {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data } = await supabase.from("users").select("*").eq("id", user.id).single();

  if (!data) {
    // The signup trigger creates this row, so its absence means the trigger did
    // not fire -- a broken migration, not a normal state. Signing out is the
    // only thing that gets the learner somewhere coherent.
    redirect("/login");
  }
  return data;
}

/** As above, but also insists onboarding is finished. */
export async function requireOnboardedProfile(): Promise<Profile> {
  const profile = await requireProfile();
  if (!profile.onboarded_at) redirect("/onboarding");
  return profile;
}
