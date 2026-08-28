import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { es } from "@/lib/copy/es";

export const metadata: Metadata = { title: es.trouble.offlineTitle };

/**
 * The backend is unreachable (PRD 7).
 *
 * Its own page rather than an error boundary, because this is not an exception
 * — nothing threw. `getUser()` returns null when it cannot reach the auth
 * server, every guard reads that as "signed out", and the learner is quietly
 * redirected to a login that cannot succeed. The truthful version of that
 * screen is this one.
 *
 * Three things it must say, and does: your progress is safe, this is ours not
 * yours, and try again later. It offers no login link on purpose — sending
 * someone to a form that will fail is how the original bug felt.
 */
export default function PausaPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-balance text-ink">{es.trouble.offlineTitle}</h1>
        <p className="text-lg text-muted">{es.trouble.offlineBody}</p>
        <p className="text-base text-faint">{es.trouble.offlineHint}</p>
      </div>

      {/* Straight back to the same page, so retrying is one tap. */}
      <ButtonLink href="/home">{es.trouble.retry}</ButtonLink>
    </main>
  );
}
