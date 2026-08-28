"use client";

import { useState } from "react";
import { reportMission } from "./actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { es } from "@/lib/copy/es";

/**
 * Reporting back on a mission (PRD F12).
 *
 * Two questions, both optional, neither a grade. "Prefiero no decir" submits
 * exactly the same row with both answers null — because the thing worth
 * recording is that the learner did it, and making them rate their own
 * discomfort as the price of admission would be a strange thing to do to
 * someone who just made themselves uncomfortable on purpose.
 */
export function MissionReport({ missionId }: { missionId: string }) {
  const [open, setOpen] = useState(false);
  const [felt, setFelt] = useState<number | null>(null);
  const [understood, setUnderstood] = useState<"yes" | "partly" | "no" | null>(null);

  if (!open) {
    return (
      <div className="mt-auto flex flex-col gap-3">
        <Button type="button" onClick={() => setOpen(true)}>
          {es.mission.start}
        </Button>
        {/* No guilt, no "are you sure", no streak at risk. */}
        <ButtonLink href="/home" variant="quiet">
          {es.mission.later}
        </ButtonLink>
      </div>
    );
  }

  return (
    <form action={reportMission} className="mt-auto flex flex-col gap-5">
      <input type="hidden" name="missionId" value={missionId} />
      <input type="hidden" name="difficultyFelt" value={felt ?? ""} />
      <input type="hidden" name="wasUnderstood" value={understood ?? ""} />

      <h2 className="text-xl font-bold text-ink">{es.mission.reportTitle}</h2>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base text-muted">{es.mission.feltLabel}</legend>
        <div className="flex gap-2">
          {([1, 2, 3] as const).map((level) => (
            <Choice
              key={level}
              selected={felt === level}
              onClick={() => setFelt(felt === level ? null : level)}
            >
              {es.mission.felt[level]}
            </Choice>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-base text-muted">{es.mission.understoodLabel}</legend>
        <div className="flex gap-2">
          {(["yes", "partly", "no"] as const).map((answer) => (
            <Choice
              key={answer}
              selected={understood === answer}
              onClick={() => setUnderstood(understood === answer ? null : answer)}
            >
              {es.mission.understood[answer]}
            </Choice>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Button type="submit">{es.mission.send}</Button>
        {/*
          A note, not a second submit button. The obvious shape here is a
          "prefer not to say" button that clears both answers and submits -- and
          it does not work: `setState` is asynchronous, so the hidden inputs
          still carry the old values when the form submits in the same tick.
          Both questions are already optional, so pressing Listo with nothing
          selected *is* saying nothing.
        */}
        <p className="text-center text-base text-faint">{es.mission.reportSkip}</p>
      </div>
    </form>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-14 flex-1 rounded-2xl border-2 px-3 text-base transition-colors ${
        selected ? "border-primary bg-primary-soft text-ink" : "border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}
