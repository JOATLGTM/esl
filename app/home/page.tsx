import type { Metadata } from "next";
import { Button, ButtonLink } from "@/components/ui/button";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { QuestList, type QuestView } from "@/components/ui/quest-list";
import { ensureDailyQuests } from "@/lib/session/rewards";
import { curriculumStatus } from "@/lib/session/store";
import { signOutAction } from "@/app/auth/actions";
import { es, fill } from "@/lib/copy/es";

export const metadata: Metadata = { title: es.home.todayTitle };

/**
 * Today (PRD 7).
 *
 * The spec is deliberately austere: one button, a progress strip, three daily
 * quests, nothing else. All three are here now.
 *
 * What is deliberately absent is as important as what is present: no countdown,
 * no "your streak is at risk", no red, and no number that can go down. "Días
 * seguidos" may quietly reset to 1 and is never announced (PRD F8).
 *
 * `current_unit` is set at onboarding from curriculum order, so the button
 * always points somewhere. If it were ever null -- a profile written before
 * that field existed -- the button would have no destination, so it falls back
 * to being disabled rather than linking to a broken route.
 */
export default async function HomePage() {
  const profile = await requireOnboardedProfile();
  const { hasNewChunks, hasNextUnit } = await curriculumStatus(profile.id, profile.current_unit);
  // Nothing new to meet and nowhere to go next. The session still runs -- the
  // story, the review queue and the speaking task are all still there -- so the
  // button stays; it just stops promising something new.
  const caughtUp = !hasNewChunks && !hasNextUnit;

  // Created on first sight of the day rather than by a scheduled job: this
  // product has no cron and should not need one, and a learner who skipped
  // Tuesday should not find Tuesday's unfinished quests waiting on Wednesday.
  const quests: QuestView[] = (
    await ensureDailyQuests(profile.id, profile.timezone, profile.daily_goal_minutes)
  ).map((quest) => ({
    type: quest.quest_type as QuestView["type"],
    target: quest.target,
    progress: quest.progress,
    completed: quest.completed,
  }));

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-between gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-base text-muted">{es.home.greeting}</p>
        <h1 className="text-3xl font-bold text-ink">{es.home.todayTitle}</h1>

        {/* Two counts, stated plainly. Neither is a target and neither can fall
            in front of the learner. */}
        {(profile.total_xp > 0 || profile.current_consecutive_days > 0) && (
          <div className="flex flex-wrap gap-x-4 text-base text-faint">
            {profile.current_consecutive_days > 0 && (
              <span>
                {profile.current_consecutive_days === 1
                  ? es.home.consecutiveDaysOne
                  : fill(es.home.consecutiveDays, { count: profile.current_consecutive_days })}
              </span>
            )}
            {profile.total_xp > 0 && <span>{fill(es.home.xp, { count: profile.total_xp })}</span>}
          </div>
        )}
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
            {profile.days_practiced === 0
              ? es.home.startSession
              : caughtUp
                ? es.home.reviewSession
                : es.home.resumeSession}{" "}
            · {fill(es.home.sessionLength, { minutes: profile.daily_goal_minutes })}
          </ButtonLink>
        ) : (
          <Button type="button" disabled>
            {es.home.startSession}
          </Button>
        )}

        {caughtUp && (
          <div className="flex flex-col gap-1">
            <p className="text-base text-ink">{es.home.caughtUp}</p>
            <p className="text-base text-faint">{es.home.caughtUpBody}</p>
          </div>
        )}
      </section>

      <QuestList quests={quests} />

      <form action={signOutAction}>
        <Button type="submit" variant="quiet">{es.home.signOut}</Button>
      </form>
    </main>
  );
}
