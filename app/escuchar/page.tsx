import Link from "next/link";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { es, fill } from "@/lib/copy/es";
import { loadListeningLibrary } from "@/lib/session/listening";

/**
 * The listening library (`docs/ROADMAP.md` #4). Everything the learner has
 * reached, grouped by unit. Deliberately not a stage: it is a shelf, and a
 * shelf with a score on it is a test.
 */
export default async function ListeningLibraryPage() {
  const profile = await requireOnboardedProfile();
  const units = await loadListeningLibrary(profile.current_unit);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">{es.listening.title}</h1>
        <Link href="/home" className="min-h-11 text-base font-medium text-muted underline underline-offset-4">
          {es.settings.back}
        </Link>
      </div>
      <p className="text-base text-muted">{es.listening.blurb}</p>

      {units.length === 0 ? (
        <p className="text-base text-faint">{es.listening.empty}</p>
      ) : (
        units.map((unit) => (
          <section key={unit.unitId} className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink">{unit.titleEs}</h2>
            <ul className="flex flex-col gap-3">
              {unit.tracks.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/escuchar/${t.id}`}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border-2 border-line bg-surface px-5 py-3"
                  >
                    <span className="flex flex-col">
                      <span className="text-lg text-ink">{t.titleEs}</span>
                      <span className="text-sm text-faint">
                        {fill(es.listening.narrator, { name: t.narrator })}
                      </span>
                    </span>
                    {t.durationS !== null && (
                      <span className="shrink-0 text-sm tabular-nums text-faint">
                        {Math.floor(t.durationS / 60)}:{String(t.durationS % 60).padStart(2, "0")}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
