import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase sends the learner back to.
 *
 * Two things land here: the OAuth round trip, and the email confirmation link
 * if confirmations are ever turned on. Both arrive as a `code` to exchange for
 * a session, and the exchange has to happen in a Route Handler because that is
 * the only place a cookie can actually be written.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  // Never redirect to a URL an attacker put in the query string.
  const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/home";

  if (!code) {
    // Supabase puts the reason in the query string on failure. It is in English
    // and not worth showing; the login screen says something useful instead.
    return NextResponse.redirect(new URL("/login", origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login", origin));

  // A brand-new OAuth account has a profile row (the signup trigger) but has
  // never seen onboarding. Sending everyone to /home lets the guard there make
  // that call in one place rather than duplicating it here.
  return NextResponse.redirect(new URL(destination, origin));
}
