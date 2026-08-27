"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { es, fill } from "@/lib/copy/es";
import { signInAction, signUpAction, type AuthState } from "./actions";

/**
 * The login and signup form.
 *
 * One component for both, because they differ only in copy and which action
 * they call -- and keeping them together is how the two stay consistent as the
 * error handling grows.
 *
 * `useActionState` keeps the typed email on screen when the server rejects
 * something. Re-typing an email address on a phone because the password was
 * short is a small cruelty that costs people.
 */
export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, {});

  if (state.awaitingConfirmation) {
    return (
      <div className="flex flex-col gap-4 rounded-card border-2 border-line bg-surface p-6">
        <h2 className="text-2xl font-bold text-ink">{es.auth.confirmTitle}</h2>
        <p className="text-muted">
          {fill(es.auth.confirmBody, { email: state.awaitingConfirmation })}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <Field
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        // Phone keyboards capitalise the first letter by default, which turns
        // a typed address into one that does not match.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        label={es.auth.email}
        error={state.fieldErrors?.email}
        required
      />

      <Field
        id="password"
        name="password"
        type="password"
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        label={es.auth.password}
        hint={mode === "signup" ? es.auth.passwordHint : undefined}
        error={state.fieldErrors?.password}
        required
      />

      {state.error && (
        <p role="alert" className="rounded-xl bg-primary-soft px-4 py-3 text-base font-medium text-ink">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? es.auth.working : mode === "signup" ? es.auth.submitSignup : es.auth.submitLogin}
      </Button>

      <p className="text-center">
        <Link
          href={mode === "signup" ? "/login" : "/signup"}
          className="text-base font-medium text-muted underline underline-offset-4 hover:text-ink"
        >
          {mode === "signup" ? es.auth.toLogin : es.auth.toSignup}
        </Link>
      </p>
    </form>
  );
}
