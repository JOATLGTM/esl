import Link from "next/link";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { es } from "@/lib/copy/es";
import { loadPhrasebook } from "@/lib/session/phrasebook-server";
import { Phrasebook } from "./phrasebook";

/**
 * The phrasebook (`docs/ROADMAP.md` #8). Everything he has met, by situation,
 * searchable, with audio -- for the moment he is standing in front of someone
 * and the lesson is not open.
 */
export default async function PhrasebookPage() {
  const profile = await requireOnboardedProfile();
  const groups = await loadPhrasebook(profile.id);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-6 px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-ink">{es.phrasebook.title}</h1>
        <Link href="/home" className="min-h-11 text-base font-medium text-muted underline underline-offset-4">
          {es.settings.back}
        </Link>
      </div>
      <p className="text-base text-muted">{es.phrasebook.blurb}</p>
      {groups.length === 0 ? (
        <p className="text-base text-faint">{es.phrasebook.empty}</p>
      ) : (
        <Phrasebook groups={groups} />
      )}
    </main>
  );
}
