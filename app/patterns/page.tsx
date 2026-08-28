import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { es, fill } from "@/lib/copy/es";
import { summarisePatterns, type ErrorEvent } from "@/lib/session/patterns";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: es.patterns.title };

/**
 * The patterns a learner keeps repeating (PRD F6).
 *
 * This page is the payoff of error detection, and it is one paragraph away from
 * being a report card. What keeps it a lesson: it names the rule rather than
 * the mistake, it shows at most three things, it needs two occurrences before
 * it says anything at all, and there is no score anywhere on it.
 *
 * Its own page rather than an interruption in the session, because being told
 * about a habit is a different act from practising, and a learner mid-review
 * has not asked to be told.
 */
export default async function PatternsPage() {
  const profile = await requireOnboardedProfile();
  const supabase = await createClient();

  // Newest first: the example shown should be the learner's most recent
  // attempt, not one they have already moved past.
  const { data } = await supabase
    .from("error_events")
    .select("error_type, user_text, corrected_text")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const events: ErrorEvent[] = (data ?? []).map((row) => ({
    errorType: row.error_type,
    userText: row.user_text,
    correctedText: row.corrected_text,
  }));
  const patterns = summarisePatterns(events);

  if (patterns.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-ink">{es.patterns.none}</h1>
          <p className="text-lg text-muted">{es.patterns.noneBody}</p>
        </div>
        <ButtonLink href="/home" variant="secondary">
          {es.patterns.back}
        </ButtonLink>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <p className="text-base font-semibold tracking-wide text-primary uppercase">
          {es.patterns.label}
        </p>
        <h1 className="text-3xl font-bold text-balance text-ink">{es.patterns.title}</h1>
        <p className="text-base text-muted">{es.patterns.intro}</p>
      </header>

      <ul className="flex flex-col gap-4">
        {patterns.map((pattern) => (
          <li
            key={pattern.key}
            className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-surface px-5 py-4"
          >
            {/* The rule first. The learner's own sentence second, as evidence
                rather than as the headline. */}
            <p className="text-lg text-ink">{pattern.explanationEs}</p>

            <div className="flex flex-col gap-1">
              <p className="text-base text-faint">
                {es.patterns.youWrote}:{" "}
                <span className="text-muted line-through">{pattern.example}</span>
              </p>
              {pattern.correction && (
                <p className="text-base text-faint">
                  {es.patterns.itIs}:{" "}
                  <span className="font-semibold text-ink">{pattern.correction}</span>
                </p>
              )}
            </div>

            <p className="text-sm text-faint">{fill(es.patterns.times, { count: pattern.times })}</p>
          </li>
        ))}
      </ul>

      <ButtonLink href="/home" variant="secondary">
        {es.patterns.back}
      </ButtonLink>
    </main>
  );
}
