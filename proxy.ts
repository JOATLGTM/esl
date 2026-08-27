import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabasePublishableKey,
  supabaseUrl,
} from "@/lib/supabase/env";

/**
 * Session refresh and route protection.
 *
 * In Next 16 this file is `proxy.ts`; `middleware.ts` is deprecated and
 * renamed. Every Supabase SSR example still says middleware -- the shape of the
 * code is the same, the filename is not.
 *
 * Two jobs, in this order:
 *
 *  1. Refresh the auth token. Server Components cannot write cookies, so if
 *     nothing refreshes the session before render, a token expires mid-session
 *     and the learner is logged out while using the app. Doing it here is what
 *     lets `lib/supabase/server.ts` swallow its cookie-write error safely.
 *
 *  2. Send signed-out visitors to the landing page instead of an empty shell.
 *     This is a redirect, not a security boundary -- row-level security is the
 *     security boundary. Nothing here is load-bearing for data access.
 */

/** Reachable without an account. Everything else needs one. */
const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  // Without configuration there is no session to refresh and no way to check
  // one. Letting the request through means `npm run dev` works on a fresh
  // clone and the missing-env error surfaces where it can be read, rather than
  // as a redirect loop on every route.
  if (!isSupabaseConfigured()) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // Anonymous visitor on a public page: there is no session to refresh and no
  // user to check, so skip the auth round trip entirely. The landing page is
  // the highest-traffic route in the product and the one most likely to be a
  // first impression on mobile data — it should not wait on an auth server to
  // tell us what the absent cookie already did.
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  if (!hasAuthCookie && isPublic(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabasePublishableKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Supabase hands back `Cache-Control: private, no-store` and friends.
        // They are not optional: a response that sets an auth cookie and gets
        // cached by a CDN serves one learner's session token to the next
        // visitor. The commonly-copied snippet predates this argument.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getUser(), never getSession(): this revalidates the token with the auth
  // server, and it is also what triggers the refresh this whole file exists for.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // So the learner lands back where they were trying to go. Someone who
    // opened the app to do their session should not have to find it again.
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except:
     *   _next/static, _next/image  framework assets
     *   audio/                     the committed Opus files (PRD 8.1C) -- these
     *                              are the bulk of every request and there is
     *                              nothing to authenticate about them
     *   favicon / image files      static assets
     */
    "/((?!_next/static|_next/image|audio/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|opus|webmanifest)$).*)",
  ],
};
