"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { es } from "@/lib/copy/es";

/**
 * Auth server actions (PRD F1).
 *
 * Everything runs on the server: credentials never touch client JavaScript, and
 * the session cookie is written by the same request that creates it.
 *
 * The whole file is written around one acceptance criterion -- "signup -> first
 * session in under 2 minutes". That rules out anything that sends the learner
 * out of the app and back, which is why a successful signup lands directly in
 * onboarding rather than in an inbox.
 */

const credentials = z.object({
  email: z.string().trim().min(1, es.auth.errors.emailRequired).email(es.auth.errors.emailInvalid),
  // Supabase's own floor is 6. Eight is a small ask and a meaningfully better
  // password; the message says the number so nobody has to guess it.
  password: z.string().min(1, es.auth.errors.passwordRequired).min(8, es.auth.errors.passwordShort),
});

export type AuthState = {
  error?: string;
  fieldErrors?: { email?: string; password?: string };
  /** Set when the project requires email confirmation before sign-in. */
  awaitingConfirmation?: string;
};

function parse(formData: FormData) {
  return credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

function fieldErrors(error: z.ZodError<z.infer<typeof credentials>>): AuthState {
  const flat = z.flattenError(error).fieldErrors;
  return {
    fieldErrors: {
      email: flat.email?.[0],
      password: flat.password?.[0],
    },
  };
}

/**
 * Map Supabase errors onto copy the learner can act on.
 *
 * Deliberately not `error.message`: those are English, they leak
 * implementation detail, and "Invalid login credentials" tells someone who is
 * already nervous that they got something wrong without saying what to do.
 */
function translate(code: string | undefined, status: number | undefined): string {
  if (code === "invalid_credentials" || code === "invalid_grant") {
    return es.auth.errors.invalidCredentials;
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return es.auth.errors.emailTaken;
  }
  if (code === "over_request_rate_limit" || code === "over_email_send_rate_limit" || status === 429) {
    return es.auth.errors.rateLimited;
  }
  if (code === "weak_password") return es.auth.errors.passwordShort;
  return es.auth.errors.generic;
}

/** Only ever redirect to a path on this site — never to a URL a caller supplied. */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/home";
  return next;
}

export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parse(formData);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: translate(error.code, error.status) };

  // With confirmations off (the configured behaviour -- see the note in
  // supabase/config.toml) signUp returns a live session and the learner is
  // already in. With them on, there is a user but no session, and the only
  // honest thing to do is say so.
  if (!data.session) {
    return { awaitingConfirmation: parsed.data.email };
  }

  redirect("/onboarding");
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = parse(formData);
  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { error: translate(error.code, error.status) };

  redirect(safeNext(formData.get("next") as string | null));
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
