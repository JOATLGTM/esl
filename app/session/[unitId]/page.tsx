import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SessionPlayer } from "./session-player";
import { ButtonLink } from "@/components/ui/button";
import { requireOnboardedProfile } from "@/lib/auth/session";
import { es } from "@/lib/copy/es";
import { loadAbsorbScene } from "@/lib/session/absorb";
import { drillBudget } from "@/lib/session/drill";
import { loadMeetChunks } from "@/lib/session/meet";
import { loadEarDrill } from "@/lib/session/ear";
import { loadDueCards, reviewBudget } from "@/lib/session/retrieve";
import { loadSessionFrame, loadSpeakTask } from "@/lib/session/speak";
import {
  availableStages,
  firstStage,
  isFinalStage,
  newChunkBudget,
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

  const available = availableStages(await loadStageInventory(profile.id, unit));
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

  // Loaded only for the stage that needs it. `advanceStage` recomputes the same
  // list with the same budget when the learner leaves Meet, which is how the
  // server records what was shown without trusting the client to say.
  const meetChunks =
    stage === "meet"
      ? await loadMeetChunks(profile.id, unit.id, newChunkBudget(profile.daily_goal_minutes))
      : [];

  // Seeded on the session so the option order survives a refresh mid-question.
  const absorbScene =
    stage === "absorb" ? await loadAbsorbScene(profile.id, unit.id, session.id) : null;

  const reviewCards =
    stage === "retrieve"
      ? await loadDueCards(profile.id, reviewBudget(profile.daily_goal_minutes), session.id)
      : [];

  const speakTask = stage === "speak" ? await loadSpeakTask(unit.id) : null;
  // Null for every unit today: frames are a type nothing has been authored
  // against yet, and the stage renders the script alone when it is.
  const speakFrame = stage === "speak" ? await loadSessionFrame(profile.id, unit.id) : null;

  const earDrill =
    stage === "ear"
      ? await loadEarDrill(
          unit.target_contrast,
          drillBudget(profile.daily_goal_minutes),
          session.id,
        )
      : null;

  return (
    <SessionPlayer
      speakTask={speakTask}
      speakFrame={speakFrame}
      earDrill={earDrill}
      meetChunks={meetChunks}
      absorbScene={absorbScene}
      reviewCards={reviewCards}
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
