"use client";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { es } from "@/lib/copy/es";

/**
 * Google sign-in (PRD F1).
 *
 * Renders nothing unless the provider is actually configured. A visible button
 * that fails is worse than no button at all -- especially as the second thing a
 * new user sees -- and this app is deliberately full of feature detection for
 * the same reason (see the microphone step, and PRD 8.2 on hiding mic
 * affordances where the Web Speech API is missing).
 *
 * To turn on: create the OAuth client, set enabled = true under
 * [auth.external.google] in supabase/config.toml, push the config, and set
 * NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1.
 */
export function GoogleButton() {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "1") return null;

  async function signIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm text-faint">
        <span className="h-px flex-1 bg-line" />
        {es.auth.or}
        <span className="h-px flex-1 bg-line" />
      </div>
      <Button type="button" variant="secondary" onClick={signIn}>
        {es.auth.google}
      </Button>
    </div>
  );
}
