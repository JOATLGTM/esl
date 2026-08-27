import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingFlow } from "./onboarding-flow";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { es } from "@/lib/copy/es";

export const metadata: Metadata = { title: es.onboarding.welcome.title };

export default async function OnboardingPage() {
  const profile = await requireProfile();
  // Finished already? Nothing here to do.
  if (profile.onboarded_at) redirect("/home");

  // The starting unit comes from curriculum order rather than a hardcoded
  // 'b1_u1'. When the adaptive placement test lands (PRD D19, Phase 2) it
  // replaces this query and nothing else on the page changes.
  const supabase = await createClient();
  const { data: firstUnit } = await supabase
    .from("units")
    .select("id")
    .order("block", { ascending: true })
    .order("order", { ascending: true })
    .limit(1)
    .single();

  return <OnboardingFlow startUnit={firstUnit?.id ?? "b1_u1"} />;
}
