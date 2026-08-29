"use client";

import { es } from "@/lib/copy/es";

/**
 * Playback speed for a scene or a listening track (`docs/ROADMAP.md` #5).
 *
 * 0.8× for the day he is tired, 1.25× for the day he is not. `playbackRate`
 * with `preservesPitch` is free, and it is the one thing "Maria at real
 * speed" can honestly promise today: `length_scale` in the pipeline gives
 * fast *citation* speech, not casual speech -- no reductions, no linking --
 * and a control the learner holds is at least a rate he chose.
 *
 * Three options, not a slider. A slider invites tuning; three buttons invite
 * a decision, and the middle one is the default so doing nothing is fine.
 */
export const SPEEDS = [0.8, 1, 1.25] as const;
export type Speed = (typeof SPEEDS)[number];

export function SpeedControl({ value, onChange }: { value: Speed; onChange: (s: Speed) => void }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label={es.listening.speed}>
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={`min-h-11 rounded-full px-3 text-base font-medium ${
            value === s ? "bg-primary-soft text-ink" : "text-muted"
          }`}
        >
          {s}×
        </button>
      ))}
    </div>
  );
}
