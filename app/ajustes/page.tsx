import Link from "next/link";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { es, fill } from "@/lib/copy/es";
import { L1_CHOICES, nearestChoice } from "@/lib/session/l1";
import { saveSettings } from "./actions";

/**
 * Settings — the one screen where the learner is in charge of the product.
 *
 * It exists because two things they had already been asked about could never
 * be changed afterwards: the daily goal was chosen once during onboarding and
 * then fixed forever, and the Spanish support level was written by the
 * curriculum and read by nothing at all.
 *
 * Deliberately not on `/home`. PRD 7 is explicit that home is one button, the
 * counts and the quests, and a settings panel there would be the first thing a
 * nervous learner fiddles with instead of practising.
 */
export default async function SettingsPage() {
  const profile = await requireOnboardedProfile();
  const current = nearestChoice(profile.l1_support_level);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">{es.settings.title}</h1>
        <Link href="/home" className="min-h-11 text-base font-medium text-muted underline underline-offset-4">
          {es.settings.back}
        </Link>
      </div>

      <form action={saveSettings} className="flex flex-col gap-8">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-xl font-bold text-ink">{es.settings.spanishTitle}</legend>
          <p className="text-base text-muted">{es.settings.spanishBlurb}</p>
          {L1_CHOICES.map((choice) => (
            <label
              key={choice}
              className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-surface px-5 py-3"
            >
              <input
                type="radio"
                name="l1_support_level"
                value={choice}
                defaultChecked={choice === current}
                className="size-5 shrink-0 accent-current text-primary"
              />
              <span className="text-lg text-ink">
                {es.settings.spanish[String(choice) as "1" | "3" | "5"]}
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-xl font-bold text-ink">{es.settings.goalTitle}</legend>
          <p className="text-base text-muted">{es.settings.goalBlurb}</p>
          {([10, 20, 30] as const).map((minutes) => (
            <label
              key={minutes}
              className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-surface px-5 py-3"
            >
              <input
                type="radio"
                name="daily_goal_minutes"
                value={minutes}
                defaultChecked={minutes === profile.daily_goal_minutes}
                className="size-5 shrink-0 accent-current text-primary"
              />
              <span className="text-lg text-ink">{fill(es.settings.goalOption, { minutes })}</span>
            </label>
          ))}
        </fieldset>

        <Button type="submit">{es.settings.save}</Button>
      </form>
    </main>
  );
}
