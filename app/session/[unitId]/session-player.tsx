"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MeetStage } from "./meet-stage";
import { advanceStage } from "../actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { es, fill } from "@/lib/copy/es";
import type { MeetChunk } from "@/lib/session/meet";
import type { Stage } from "@/lib/session/stages";

/**
 * The session shell (PRD 4.2 / 7).
 *
 * One stage on screen at a time, one forward action, and one way out that costs
 * nothing. The shell owns the progress strip, the clock and the exit; each
 * stage owns its own body and its own primary button, because "Siguiente" on
 * the fourth of six phrases and "Continuar" on the last are the same button
 * doing different jobs, and only the stage knows which.
 *
 * Absorb, Retrieve, Speak and Ear are still placeholders and say so, rather
 * than showing a screen that does nothing.
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
  meetChunks,
}: {
  sessionId: string;
  unitTitle: string;
  stage: Stage;
  position: number;
  total: number;
  isFinal: boolean;
  resumed: boolean;
  meetChunks: MeetChunk[];
}) {
  const [pending, startTransition] = useTransition();

  // The stage this visit opened on, captured once. `resumed` from the server is
  // only ever "this session had already progressed", which is also true of every
  // stage after the first -- so on its own it puts "we picked up where you left
  // off" under a stage the learner just walked into. Comparing against the entry
  // stage keeps the note on the screen it is actually about.
  const [entryStage] = useState(stage);
  const showResumed = resumed && stage === entryStage;

  // Started in an effect rather than at `useRef(Date.now())`: reading the clock
  // during render is impure, and a re-render would silently restart the timer.
  // The effect also re-runs on every stage change -- the component survives one,
  // because the server re-renders it in place -- so each stage is timed from
  // when it appeared instead of billing it for the stages before it.
  const enteredAt = useRef(0);

  useEffect(() => {
    enteredAt.current = Date.now();
  }, [stage]);

  function advance(revealedChunkIds?: string[]) {
    const elapsedS = enteredAt.current ? (Date.now() - enteredAt.current) / 1000 : 0;
    // Guarded, not merely typed. Wire this to `onClick={advance}` anywhere and
    // React hands it a SyntheticEvent as the first argument; that crosses to
    // the server as an opaque client reference, and the whole advance dies with
    // "Cannot access length on the server" -- an error that names neither the
    // button nor the argument. TypeScript cannot see it because a mouse event
    // handler is a legal `(x?: string[]) => void` as far as the checker knows.
    const revealed = Array.isArray(revealedChunkIds) ? revealedChunkIds : undefined;
    startTransition(async () => {
      await advanceStage({ sessionId, from: stage, elapsedS, revealedChunkIds: revealed });
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-8">
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

        {showResumed && <p className="text-base text-faint">{es.session.resumed}</p>}
      </header>

      {stage === "meet" ? (
        <MeetStage chunks={meetChunks} pending={pending} onAdvance={advance} />
      ) : (
        <NotBuiltYet stage={stage} pending={pending} isFinal={isFinal} onAdvance={advance} />
      )}

      <footer className="flex flex-col gap-2">
        <ButtonLink href="/home" variant="quiet">
          {es.session.exit}
        </ButtonLink>
        <p className="text-center text-base text-faint">{es.session.exitNote}</p>
      </footer>
    </main>
  );
}

/** The seam the remaining four stages drop into. */
function NotBuiltYet({
  stage,
  pending,
  isFinal,
  onAdvance,
}: {
  stage: Stage;
  pending: boolean;
  isFinal: boolean;
  onAdvance: () => void;
}) {
  const copy = es.session.stages[stage];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-1 flex-col justify-center gap-3">
        <h1 className="text-3xl font-bold text-ink">{copy.title}</h1>
        <p className="text-lg text-muted">{copy.blurb}</p>
        <p className="mt-4 rounded-2xl border-2 border-line bg-surface px-5 py-4 text-base text-faint">
          {es.session.underConstruction}
        </p>
      </div>

      {/* Wrapped, so the click event is not passed as an argument -- see the
          guard in `advance`. */}
      <Button type="button" onClick={() => onAdvance()} disabled={pending}>
        {pending ? es.common.loading : isFinal ? es.session.finish : es.session.continue}
      </Button>
    </div>
  );
}
