"use client";

import { useState } from "react";
import { es } from "@/lib/copy/es";
import { acceptMoreSupport } from "@/app/ajustes/actions";

/**
 * The offer of more Spanish (PRD F2).
 *
 * Offered, never imposed, and never framed as a problem. The learner has been
 * reaching for the translation and that is a perfectly good thing to do; the
 * copy says so, and the dismiss option is a real one that costs nothing.
 *
 * Dismissal is client-side only and lasts until the page reloads. Persisting it
 * would need a column, and the offer is cheap enough to see again: the
 * condition that raises it is a sustained pattern, not a single session, so it
 * will not flicker in and out between visits.
 */
export function SupportOffer({ level }: { level: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState(false);
  if (dismissed) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface px-5 py-4">
      <p className="text-lg font-bold text-ink">{es.settings.offerTitle}</p>
      <p className="text-base text-muted">{es.settings.offerBody}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            // Guarded: wiring a Server Action straight to onClick hands it the
            // click event, which crosses the boundary as an opaque client
            // reference and kills the action with an error naming neither the
            // button nor the argument.
            void acceptMoreSupport(level);
          }}
          className="min-h-11 rounded-full bg-primary px-5 text-base font-medium text-on-primary"
        >
          {pending ? es.common.loading : es.settings.offerAccept}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-11 px-2 text-base font-medium text-muted underline underline-offset-4"
        >
          {es.settings.offerDismiss}
        </button>
      </div>
    </section>
  );
}
