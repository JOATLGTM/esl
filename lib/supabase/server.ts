import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";
import type { Database } from "./types";

/**
 * The server client, for Server Components, Server Actions and Route Handlers.
 *
 * A new client per request, never a module-level singleton: it closes over one
 * request's cookies, and sharing it across requests would serve one learner's
 * session to another.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot set cookies, and this throws when a
          // refreshed token lands during render. Ignoring it is correct here
          // *because* proxy.ts refreshes the session before the render begins,
          // so the cookie has already been written. Without that, sessions
          // would expire silently and users would be logged out mid-session.
        }
      },
    },
  });
}

/**
 * The authenticated user, verified against the auth server.
 *
 * Always this, never `getSession()`, in anything that gates access. A session
 * read from the cookie is client-supplied data; `getUser()` revalidates the JWT
 * with Supabase. The difference is whether a forged cookie can read someone
 * else's progress.
 */
export async function getUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}
