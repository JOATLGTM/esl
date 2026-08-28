import "server-only";
import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./env";

/**
 * Is the backend actually there?
 *
 * This exists because of what the app does when it is *not*. A learner with a
 * valid session, whose database has gone away, is not shown an error — every
 * guarded route redirects to `/login?next=...`, because `getUser()` returns
 * null on any failure and the guards read that as "signed out". So the product
 * silently forgets him, sends him to a login that cannot succeed, and explains
 * nothing. Verified by pointing the app at an unreachable project: `/home`,
 * `/session` and `/mission` all 307 to login, and the landing page cheerfully
 * says the sample lesson "se está preparando", which is untrue.
 *
 * For a beginner who already suspects he is the problem, "the app forgot me and
 * won't let me back in" is worse than any error page.
 *
 * `getUser()` cannot be the signal: with no session cookie the client
 * short-circuits and returns `AuthSessionMissingError` without touching the
 * network, which is byte-identical to what a dead backend returns. So this asks
 * the content tables instead -- they are public-read, so the question "is the
 * database there" can be asked without being anybody.
 */

/**
 * Long enough to survive a slow phone network, short enough that a learner is
 * not staring at a blank screen. An unreachable host takes ~7s to fail on DNS
 * alone, which is most of the way to someone closing the tab.
 */
const TIMEOUT_MS = 2500;

export type Reachability = "ok" | "unreachable" | "unconfigured";

/**
 * Deliberately called only on a path that is *already* failing -- see
 * `requireProfile`. Asking on every request would add a round trip to every
 * page to answer a question that is almost always "yes".
 */
export async function backendReachability(): Promise<Reachability> {
  if (!isSupabaseConfigured()) return "unconfigured";

  try {
    const probe = createClient(supabaseUrl(), supabasePublishableKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await probe
      .from("units")
      .select("id", { head: true, count: "exact" })
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));

    // A reachable project answers, even if the answer is a permission error.
    // Only a transport failure means nobody is home: PostgREST reports those
    // with an empty `code` and a `fetch failed` message.
    if (error && (error.code === "" || /fetch failed|aborted|timeout/i.test(error.message))) {
      return "unreachable";
    }
    return "ok";
  } catch {
    // AbortSignal.timeout throws rather than resolving, and a DNS failure can
    // surface here too depending on the runtime.
    return "unreachable";
  }
}
