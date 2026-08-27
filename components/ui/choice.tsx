"use client";

/**
 * A big tappable choice, used throughout onboarding.
 *
 * Radio semantics rather than buttons, so the whole group is one stop in the
 * tab order and arrow keys move between options -- which is what a screen
 * reader user expects from "pick one of these".
 */
export function ChoiceList<T extends string | number>({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: T | null;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint?: string }[];
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-col gap-3">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex min-h-16 flex-col items-start justify-center rounded-2xl border-2 px-5 py-3 text-left transition-colors ${
              selected
                ? "border-primary bg-primary-soft"
                : "border-line bg-surface hover:border-faint"
            }`}
          >
            <span className="text-lg font-semibold text-ink">{option.label}</span>
            {option.hint && <span className="text-base text-muted">{option.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
