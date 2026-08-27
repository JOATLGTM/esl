"use client";

import { useEffect, useRef, useTransition } from "react";
import { advanceStage } from "../actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { es, fill } from "@/lib/copy/es";
import type { Stage } from "@/lib/session/stages";

/**
 * The session shell (PRD 4.2 / 7).
 *
 * One stage on screen at a time, one forward action, and one way out that
 * costs nothing. The stage bodies themselves land one at a time -- Meet,
 * Absorb, Retrieve, Speak, and Ear last, once the human recordings exist --
 * and until then each says so rather than showing a screen that does nothing,
 * which is the same promise /home made while this player was being built.
 *
 * Time on a stage is measured here and sent with the advance, not inferred
 * server-side from `started_at`. A session resumed the next morning would
 * otherwise report the whole night as practice, and `sessions.duration_s`
 * feeds PRD 3's counter-metric -- it has to be honest to be worth having.
 */
export function SessionPlayer({
  sessionId,
  unitTitle,
  stage,
  position,
  total,
  isFinal,
  resumed,
}: {
  sessionId: string;
  unitTitle: string;
  stage: Stage;
  position: number;
  total: number;
  isFinal: boolean;
  resumed: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // Started in an effect rather than at `useRef(Date.now())`: reading the clock
  // during render is impure, and a re-render would silently restart the timer.
  // The effect also re-runs on every stage change -- the component survives one,
  // because the server re-renders it in place -- so each stage is timed from
  // when it appeared instead of billing it for the stages before it.
  const enteredAt = useRef(0);

  useEffect(() => {
    enteredAt.current = Date.now();
  }, [stage]);

  function advance() {
    const elapsedS = enteredAt.current ? (Date.now() - enteredAt.current) / 1000 : 0;
    startTransition(async () => {
      await advanceStage({ sessionId, from: stage, elapsedS });
    });
  }

  const copy = es.session.stages[stage];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-base text-muted">{unitTitle}</p>
          <p className="text-base text-faint">
            {fill(es.session.progress, { position, total })}
          </p>
        </div>

        {/* Presentational: the same counts are in the text above, which is what
            a screen reader announces. */}
        <ol aria-hidden className="flex gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <li
              key={i}
              className={`h-1.5 flex-1 rounded-full ${i < position ? "bg-primary" : "bg-line"}`}
            />
          ))}
        </ol>
      </header>

      <section className="flex flex-1 flex-col justify-center gap-3">
        <h1 className="text-3xl font-bold text-ink">{copy.title}</h1>
        <p className="text-lg text-muted">{copy.blurb}</p>
        {resumed && <p className="text-base text-faint">{es.session.resumed}</p>}
        <p className="mt-4 rounded-2xl border-2 border-line bg-surface px-5 py-4 text-base text-faint">
          {es.session.underConstruction}
        </p>
      </section>

      <footer className="flex flex-col gap-3">
        <Button type="button" onClick={advance} disabled={pending}>
          {pending ? es.common.loading : isFinal ? es.session.finish : es.session.continue}
        </Button>
        <ButtonLink href="/home" variant="quiet">
          {es.session.exit}
        </ButtonLink>
        <p className="text-center text-base text-faint">{es.session.exitNote}</p>
      </footer>
    </main>
  );
}
