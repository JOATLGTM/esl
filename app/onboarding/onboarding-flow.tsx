"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChoiceList } from "@/components/ui/choice";
import { es, fill } from "@/lib/copy/es";
import { completeOnboarding } from "./actions";

/**
 * The five onboarding screens (PRD F1), in one client component.
 *
 * Answers are held in memory and written once at the end. The budget is 90
 * seconds and the acceptance criterion is signup-to-first-session under two
 * minutes; a server round trip per screen would spend a sixth of that on
 * spinners.
 *
 * There is no way to get stuck. Every screen except the microphone one has a
 * single forward action, `Atrás` always works, and the microphone screen has
 * two equally-weighted exits because refusing it must cost nothing (PRD F1:
 * "Denying microphone blocks nothing").
 */

type Motivation = "work" | "travel" | "family" | "study" | "other";
type MicOutcome = "granted" | "denied" | "unsupported" | "skipped";

const TOTAL_STEPS = 5;

export function OnboardingFlow({ startUnit }: { startUnit: string }) {
  const [step, setStep] = useState(0);
  const [motivation, setMotivation] = useState<Motivation | null>(null);
  const [goal, setGoal] = useState<10 | 20 | 30 | null>(20);
  const [mic, setMic] = useState<MicOutcome | null>(null);
  const [asking, setAsking] = useState(false);
  const [pending, startTransition] = useTransition();

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  async function askForMicrophone() {
    // Feature-detect first. Firefox and older mobile browsers will not have
    // this, and prompting into a missing API produces a console error and a
    // learner who thinks they broke something.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setMic("unsupported");
      return;
    }
    setAsking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Release it immediately. Holding the mic open past the question keeps a
      // recording indicator lit in the browser chrome, which is alarming and
      // entirely unnecessary -- this step only wanted the permission.
      for (const track of stream.getTracks()) track.stop();
      setMic("granted");
    } catch {
      // Denied, dismissed, or no device. All the same from here: it does not
      // block anything, so it does not need to be told apart.
      setMic("denied");
    } finally {
      setAsking(false);
    }
  }

  function finish() {
    const data = new FormData();
    data.set("motivation", motivation ?? "other");
    data.set("daily_goal_minutes", String(goal ?? 20));
    data.set("mic_permission", mic ?? "skipped");
    data.set("start_unit", startUnit);
    startTransition(() => completeOnboarding(data));
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <Progress step={step} />

      {/* The panel grows; the actions stay put. A primary button that moves
          between screens gets mis-tapped one-handed. */}
      <div className="flex flex-1 flex-col justify-center py-8">
        {step === 0 && (
          <Panel title={es.onboarding.welcome.title} body={es.onboarding.welcome.body}>
            <p className="text-base text-faint">{es.onboarding.welcome.note}</p>
          </Panel>
        )}

        {step === 1 && (
          <Panel title={es.onboarding.motivation.title} body={es.onboarding.motivation.body}>
            <ChoiceList<Motivation>
              name={es.onboarding.motivation.title}
              value={motivation}
              onChange={setMotivation}
              options={(Object.keys(es.onboarding.motivation.options) as Motivation[]).map((key) => ({
                value: key,
                label: es.onboarding.motivation.options[key].label,
                hint: es.onboarding.motivation.options[key].hint,
              }))}
            />
          </Panel>
        )}

        {step === 2 && (
          <Panel title={es.onboarding.placement.title} body={es.onboarding.placement.body}>
            {/* PRD F1: a starting point, never a score. There is no number on
                this screen and there is not meant to be. */}
            <p className="rounded-xl bg-primary-soft px-4 py-3 text-base font-medium text-ink">
              {es.onboarding.placement.reassurance}
            </p>
            <p className="text-base text-faint">{es.onboarding.placement.note}</p>
          </Panel>
        )}

        {step === 3 && (
          <Panel title={es.onboarding.microphone.title} body={es.onboarding.microphone.body}>
            {mic === "granted" && <Outcome tone="good" text={es.onboarding.microphone.granted} />}
            {mic === "denied" && <Outcome tone="calm" text={es.onboarding.microphone.denied} />}
            {mic === "unsupported" && <Outcome tone="calm" text={es.onboarding.microphone.unsupported} />}
          </Panel>
        )}

        {step === 4 && (
          <Panel title={es.onboarding.goal.title} body={es.onboarding.goal.body}>
            <ChoiceList<10 | 20 | 30>
              name={es.onboarding.goal.title}
              value={goal}
              onChange={setGoal}
              options={([10, 20, 30] as const).map((minutes) => ({
                value: minutes,
                label: es.onboarding.goal.options[minutes].label,
                hint: es.onboarding.goal.options[minutes].hint,
              }))}
            />
            {/* Said here, on the way in, rather than after the first missed day
                (PRD F8: additive streaks, never a punishment). */}
            <p className="text-base text-faint">{es.onboarding.goal.note}</p>
          </Panel>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {step === 3 && mic === null ? (
          <>
            <Button type="button" onClick={askForMicrophone} disabled={asking}>
              {asking ? es.auth.working : es.onboarding.microphone.allow}
            </Button>
            {/* Same size, same shape, no visual penalty. The learner who taps
                this must not feel they took the lesser path. */}
            <Button type="button" variant="secondary" onClick={() => { setMic("skipped"); next(); }}>
              {es.onboarding.microphone.skip}
            </Button>
          </>
        ) : step === TOTAL_STEPS - 1 ? (
          <Button type="button" onClick={finish} disabled={pending || goal === null}>
            {pending ? es.auth.working : es.onboarding.finish}
          </Button>
        ) : (
          <Button type="button" onClick={next} disabled={step === 1 && motivation === null}>
            {es.onboarding.next}
          </Button>
        )}

        {step > 0 && (
          <Button type="button" variant="quiet" onClick={back}>
            {es.onboarding.back}
          </Button>
        )}
      </div>
    </div>
  );
}

function Progress({ step }: { step: number }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-faint">
        {fill(es.onboarding.stepOf, { current: step + 1, total: TOTAL_STEPS })}
      </p>
      <div
        className="flex gap-1.5"
        role="progressbar"
        aria-valuenow={step + 1}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={fill(es.onboarding.stepOf, { current: step + 1, total: TOTAL_STEPS })}
      >
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-line"}`}
          />
        ))}
      </div>
    </div>
  );
}

function Panel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      {/* aria-live so a screen reader announces each new screen; the heading
          changes without a navigation, so nothing would say it otherwise. */}
      <h1 className="text-3xl font-bold text-ink" aria-live="polite">{title}</h1>
      <p className="text-lg text-muted">{body}</p>
      {children}
    </section>
  );
}

function Outcome({ tone, text }: { tone: "good" | "calm"; text: string }) {
  return (
    <p
      role="status"
      className={`rounded-xl px-4 py-3 text-base font-medium ${
        tone === "good" ? "bg-primary-soft text-ink" : "bg-surface text-muted border-2 border-line"
      }`}
    >
      {text}
    </p>
  );
}
