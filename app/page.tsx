import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { SampleLesson, type SampleChunk } from "./sample-lesson";
import { createClient, getUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { es } from "@/lib/copy/es";
import type { ChunkAudio } from "@/lib/supabase/types";

/**
 * Landing (PRD 7): Spanish, one CTA, and a real sample lesson before signup.
 *
 * The sample is read with the anonymous key, which is the content policy doing
 * its job: `chunks` is public-read and has no write policy at all, so a signed-
 * out visitor can hear the lesson and cannot touch the curriculum.
 */

// No `revalidate` here, and not by oversight: the page checks for a session in
// order to send a signed-in learner straight to /home, which makes it dynamic
// regardless. If the sample query ever gets hot, cache that call specifically
// rather than putting a caching directive on the page that cannot take effect.

async function sampleChunks(): Promise<SampleChunk[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("chunks")
    .select("id, en_text, es_gloss, audio_urls")
    .order("id", { ascending: true })
    .limit(12);

  return (data ?? [])
    .map((chunk) => ({
      id: chunk.id,
      en: chunk.en_text,
      es: chunk.es_gloss,
      url: ((chunk.audio_urls as ChunkAudio[] | null) ?? [])[0]?.url ?? null,
    }))
    .filter((chunk) => chunk.url)
    .slice(0, 3);
}

export default async function LandingPage() {
  // Someone with a session does not need the pitch.
  if (await getUser()) redirect("/home");

  const chunks = await sampleChunks();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-10 px-5 py-12">
      <header className="flex flex-col gap-3">
        <p className="text-base font-semibold tracking-wide text-primary uppercase">
          {es.app.name}
        </p>
        <h1 className="text-4xl font-bold text-ink">{es.landing.heading}</h1>
        <p className="text-lg text-muted">{es.landing.subheading}</p>
      </header>

      <SampleLesson chunks={chunks} />

      <ul className="flex flex-col gap-3">
        {es.landing.promises.map((promise) => (
          <li key={promise} className="flex gap-3 text-base text-muted">
            <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-primary" />
            {promise}
          </li>
        ))}
      </ul>

      {/* One CTA, at the bottom, where a thumb already is. */}
      <div className="mt-auto flex flex-col gap-3">
        <ButtonLink href="/signup">{es.landing.cta}</ButtonLink>
        <ButtonLink href="/login" variant="quiet">{es.landing.ctaSecondary}</ButtonLink>
      </div>
    </main>
  );
}
