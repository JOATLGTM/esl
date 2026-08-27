import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/app/auth/auth-form";
import { GoogleButton } from "@/app/auth/google-button";
import { getUser } from "@/lib/supabase/server";
import { es } from "@/lib/copy/es";

export const metadata: Metadata = { title: es.auth.signupTitle };

export default async function SignupPage() {
  if (await getUser()) redirect("/home");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-ink">{es.auth.signupTitle}</h1>
        <p className="text-muted">{es.auth.signupSubtitle}</p>
      </header>
      <AuthForm mode="signup" />
      <GoogleButton />
    </main>
  );
}
