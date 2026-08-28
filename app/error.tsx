"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { es } from "@/lib/copy/es";

/**
 * The safety net for an unexpected exception (PRD 7).
 *
 * Before this existed, anything that threw rendered Next's default page —
 * "Application error: a server-side exception has occurred" — in English, to a
 * learner who reads Spanish, on a product whose stated test is "would a nervous
 * 19-year-old quit at this screen?"
 *
 * It deliberately says nothing about *why*. Next strips the message from
 * server-component errors in production and forwards only a digest, so any
 * attempt to explain the cause here would be a guess dressed as information.
 * The specific case worth naming — the backend being unreachable — is detected
 * server-side instead, where the truth is available (`lib/supabase/health.ts`).
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // The digest is the only thing that ties this screen to a server log.
    console.error("session error", error.digest ?? error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-ink">{es.trouble.title}</h1>
        <p className="text-lg text-muted">{es.trouble.body}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Button type="button" onClick={() => retry()}>
          {es.trouble.retry}
        </Button>
        <ButtonLink href="/home" variant="quiet">
          {es.trouble.home}
        </ButtonLink>
      </div>
    </main>
  );
}
