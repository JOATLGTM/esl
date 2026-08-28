import type { Metadata } from "next";
import { MissionReport } from "./mission-report";
import { ButtonLink } from "@/components/ui/button";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { es, fill } from "@/lib/copy/es";
import { loadCurrentMission } from "@/lib/session/missions";

export const metadata: Metadata = { title: es.mission.label };

/**
 * A real-world mission (PRD F12).
 *
 * Its own page rather than a stage in the session, because it is the one thing
 * in the product that does not happen on the phone. Putting it inside the daily
 * loop would make it feel like another exercise to tap through; on its own page
 * it reads as what it is — an instruction to go and speak to a person.
 */
export default async function MissionPage({
  searchParams,
}: PageProps<"/mission">) {
  const profile = await requireOnboardedProfile();
  const params = await searchParams;
  const mission = await loadCurrentMission(profile.id, profile.current_unit);

  // Straight after a report, and when the learner has done everything offered
  // so far. Both say the same thing, because both are good news.
  if (params.done || !mission) {
    const done = Boolean(params.done);
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-ink">
            {done ? es.mission.thanks : es.mission.none}
          </h1>
          <p className="text-lg text-muted">
            {done ? es.mission.thanksBody : es.mission.noneBody}
          </p>
        </div>
        <ButtonLink href="/home" variant="secondary">
          {es.mission.back}
        </ButtonLink>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-base font-semibold tracking-wide text-primary uppercase">
            {es.mission.label}
          </p>
          <p className="text-base text-faint">
            {fill(es.mission.difficulty, { level: mission.difficulty })}
          </p>
        </div>
        <h1 className="text-3xl font-bold text-balance text-ink">{mission.titleEs}</h1>
        <p className="text-base text-faint">{es.mission.outOfApp}</p>
      </header>

      <p className="text-lg leading-relaxed text-ink">{mission.instructionsEs}</p>

      {/* Offered as an equal option, not hidden behind a "can't do it?" link. A
          learner with no English speakers near them is exactly who this course
          is for, and the alternative has to read that way. */}
      <section className="flex flex-col gap-2 rounded-2xl border-2 border-line bg-surface px-5 py-4">
        <h2 className="text-base font-semibold text-ink">{es.mission.alternateTitle}</h2>
        <p className="text-base text-muted">{mission.alternateEs}</p>
        <p className="text-base text-faint">{es.mission.alternateNote}</p>
      </section>

      <MissionReport missionId={mission.id} />
    </main>
  );
}
