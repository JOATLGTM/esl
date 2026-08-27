import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * The browser client.
 *
 * Safe to call anywhere in client code: `createBrowserClient` returns the same
 * instance for the same arguments, so this is a lookup, not a connection.
 *
 * It authenticates with the publishable key, which is public by design — every
 * query it makes is still filtered by row-level security. The security boundary
 * is the policy, never the key.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabasePublishableKey());
}
