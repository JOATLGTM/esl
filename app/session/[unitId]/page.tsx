import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessionPlayer } from "./session-player";
import { ButtonLink } from "@/components/ui/button";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { es } from "@/lib/copy/es";
import {
  availableStages,
  firstStage,
  isFinalStage,
  resumeAt,
  stageProgress,
} from "@/lib/session/stages";
import { loadStageInventory, loadUnit, openSession } from "@/lib/session/store";

export const metadata: Metadata = { title: es.home.todayTitle };

/**
 * The daily session (PRD 4.2): five stages, linear, resumable.
 *
 * The current stage is server state, not a URL segment or a query string. That
 * is deliberate. A stage in the URL is a stage a learner can type -- and the
 * order is pedagogical, not cosmetic: retrieval before the chunks have been
 * met is a quiz on material never shown. Keeping it in `sessions.stage_reached`
 * also makes resuming free, because the resume point and the render point are
 * the same value.
 *
 * The page decides what to show; `advanceStage` decides what comes next. Both
 * read the same inventory, so they cannot disagree about which stages exist.
 */
export default async function SessionPage({ params }: PageProps<"/session/[unitId]">) {
  const { unitId } = await params;
  const profile = await requireOnboardedProfile();

  const unit = await loadUnit(unitId);
  if (!unit) notFound();

  const available = availableStages(await loadStageInventory(unit));
  const start = firstStage(available);

  // Nothing to serve. Today this is what an ear-training-only unit looks like
  // before its recordings exist, and it is the one case that must not open an
  // empty session: a row that can never be completed would count as an
  // abandoned session forever.
  if (!start) return <Interstitial title={es.session.empty.title} body={es.session.empty.body} />;

  const session = await openSession(profile.id, unit.id, start);
  const stage = resumeAt(session.stage_reached, available);

  // The stage the learner stopped on is gone and nothing follows it, so there
  // is nothing left to do here. The session stays open and closes on the next
  // advance rather than being completed from inside a render.
  if (!stage) return <Interstitial title={es.session.done.title} body={es.session.done.body} />;

  const { position, total } = stageProgress(stage, available);

  return (
    <SessionPlayer
      sessionId={session.id}
      unitTitle={unit.title_es}
      stage={stage}
      position={position}
      total={total}
      isFinal={isFinalStage(stage, available)}
      resumed={stage !== start}
    />
  );
}

/** A full-screen dead stop that is never actually dead: it always offers the way back. */
function Interstitial({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="text-lg text-muted">{body}</p>
      </div>
      <ButtonLink href="/home" variant="secondary">
        {es.session.empty.back}
      </ButtonLink>
    </main>
  );
}
