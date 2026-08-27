import type { ComponentProps } from "react";

/**
 * A labelled input.
 *
 * The label is always visible -- never a placeholder standing in for one. A
 * placeholder disappears the moment someone starts typing, which is exactly
 * when a learner reading a second language needs it most.
 */
export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-base font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        // 17px minimum. Anything under 16px makes iOS Safari zoom the page on
        // focus, which on a 360px screen is disorienting and hard to undo.
        className={`min-h-14 rounded-xl border-2 bg-surface px-4 text-lg text-ink
          placeholder:text-faint ${error ? "border-primary" : "border-line"}`}
        aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {hint && !error && (
        <p id={hintId} className="text-sm text-muted">{hint}</p>
      )}
      {error && (
        // `role="alert"` so a screen reader announces it without the learner
        // having to go looking for what changed.
        <p id={errorId} role="alert" className="text-base font-medium text-primary">
          {error}
        </p>
      )}
    </div>
  );
}
