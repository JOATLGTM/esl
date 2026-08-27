import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * The service-role client. It bypasses row-level security entirely.
 *
 * There is exactly one legitimate use for this in the product: seeding content
 * (PRD 8.3). Content tables are public-read and have no write policy at all, so
 * the seed script is the only writer and this is the only key that can do it.
 *
 * It must never be used to read or write learner data. Every learner-facing
 * query goes through `server.ts` or `client.ts`, where RLS applies -- if a
 * feature seems to need the admin client to work, the policy is wrong and the
 * policy is what should change.
 *
 * This file deliberately does NOT use the `server-only` package, even though it
 * is the obvious guard: `server-only` throws under plain Node, which would make
 * it unimportable from the seed script -- the one caller that legitimately
 * needs it. The protection is instead split in two, and both halves matter:
 *
 *   - the key is read without a `NEXT_PUBLIC_` prefix, so Next cannot inline it
 *     into a client bundle even if something imports this by mistake;
 *   - tests/no-paid-apis.test.ts fails the build if anything under `app/` or
 *     `components/` imports this module at all.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createAdminClient() was called in a browser. This client bypasses row-level " +
        "security and must never run client-side — use lib/supabase/client.ts."
    );
  }
  return createSupabaseClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
