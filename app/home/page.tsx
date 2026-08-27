import type { Metadata } from "next";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { signOutAction } from "@/app/auth/actions";
import { es, fill } from "@/lib/copy/es";

export const metadata: Metadata = { title: es.home.todayTitle };

/**
 * Today (PRD 7).
 *
 * The spec is deliberately austere: one button, a progress strip, three daily
 * quests, nothing else. The button is now real and opens the session player;
 * the quests and the streak strip arrive with F8.
 *
 * `current_unit` is set at onboarding from curriculum order, so the button
 * always points somewhere. If it were ever null -- a profile written before
 * that field existed -- the button would have no destination, so it falls back
 * to being disabled rather than linking to a broken route.
 */
export default async function HomePage() {
  const profile = await requireOnboardedProfile();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between gap-8 px-5 py-10">
      <header className="flex flex-col gap-1">
        <p className="text-base text-muted">{es.home.greeting}</p>
        <h1 className="text-3xl font-bold text-ink">{es.home.todayTitle}</h1>
      </header>

      <section className="flex flex-col gap-4">
        <p className="text-lg text-muted">
          {profile.days_practiced === 0
            ? es.home.firstSession
            : profile.days_practiced === 1
              ? es.home.daysPracticedOne
              : fill(es.home.daysPracticed, { count: profile.days_practiced })}
        </p>

        {profile.current_unit ? (
          <ButtonLink href={`/session/${profile.current_unit}`}>
            {profile.days_practiced === 0 ? es.home.startSession : es.home.resumeSession} ·{" "}
            {fill(es.home.sessionLength, { minutes: profile.daily_goal_minutes })}
          </ButtonLink>
        ) : (
          <Button type="button" disabled>
            {es.home.startSession}
          </Button>
        )}
      </section>

      <form action={signOutAction}>
        <Button type="submit" variant="quiet">{es.home.signOut}</Button>
      </form>
    </main>
  );
}
