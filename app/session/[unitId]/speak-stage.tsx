"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpeakerIcon } from "@/components/ui/speaker-icon";
import { es, fill } from "@/lib/copy/es";
import type { SpeakTask } from "@/lib/session/speak";
import { buildFrameDrill, type SessionFrame } from "@/lib/session/frame-drill";
import { FORMULATION_ROUNDS, ROUND_SECONDS, type FormulationPrompt } from "@/lib/session/formulate";

/**
 * Stage 5, Speak (PRD 4.2 / 4.5): the learner says the lines out loud.
 *
 * Scripted mode: the exact line is on screen and success is saying it. There is
 * no pronunciation score and no pass mark — the counter-metric this product is
 * built around is speaking minutes, and anything that makes a beginner afraid
 * to open their mouth costs more than it could measure.
 *
 * Recording is offered and never required. The mic is optional forever, so the
 * "Ya lo dije" path is the primary one and the recorder is a side offer that
 * can fail silently without blocking anything.
 *
 * The stage runs in three phases. First a warm-up: Spanish on screen, a
 * visible clock, and the learner says the English *before* it appears. That is
 * formulation -- the message-to-form step -- and it is the one thing neither
 * typed retrieval nor reading a line aloud ever asked for. The clock is
 * pressure, never a grade: it runs out, the answer appears, nothing is written.
 * Then the script, which is recall with the exact line on screen. Then, if the
 * unit has a frame, the learner builds a sentence of their own -- the first
 * thing in the whole product nobody wrote for them. That comes last on purpose:
 * producing something new is easier right after saying things that worked.
 */
export function SpeakStage({
  task,
  formulation,
  frame,
  frameSeed,
  pending,
  isFinal,
  onAdvance,
  onSpoke,
}: {
  task: SpeakTask | null;
  /** The warm-up hand: met phrases, Spanish first. Empty skips the phase. */
  formulation: FormulationPrompt[];
  /** Null for every unit today -- no frames are authored yet. */
  frame: SessionFrame | null;
  /** Seeded on the session so a re-render cannot move the buttons. */
  frameSeed: string;
  pending: boolean;
  isFinal: boolean;
  onAdvance: () => void;
  onSpoke: (blob: Blob | null, durationS: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"formulate" | "script" | "frame">(
    formulation.length > 0 ? "formulate" : "script",
  );
  const [chosen, setChosen] = useState<string | null>(null);
  // The warm-up's own cursor: which round, which prompt, whether the clock
  // has started, whether the English is showing, and the seconds left. One
  // object so that moving on resets all of it in one render. The same five
  // prompts run three rounds with a shrinking clock -- repetition of the same
  // material is the drill's active ingredient, not variety.
  const [warm, setWarm] = useState<{
    round: number;
    index: number;
    started: boolean;
    revealed: boolean;
    left: number;
  }>({
    round: 0,
    index: 0,
    started: false,
    revealed: false,
    left: ROUND_SECONDS[0],
  });
  const modelRef = useRef<HTMLAudioElement | null>(null);

  // The countdown. Runs only while a prompt is live and unrevealed, and the
  // reveal at zero happens here rather than in render so the clock cannot
  // reveal twice. No Date.now() in render -- the compiler's purity rule.
  useEffect(() => {
    if (phase !== "formulate" || !warm.started || warm.revealed) return;
    const tick = setInterval(() => {
      setWarm((w) => {
        if (w.revealed) return w;
        if (w.left <= 1) return { ...w, left: 0, revealed: true };
        return { ...w, left: w.left - 1 };
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [phase, warm.started, warm.revealed]);

  // Play the model clip the moment the English is revealed, however it was
  // revealed -- the comparison is the point, and it should not need a tap.
  useEffect(() => {
    if (phase !== "formulate" || !warm.revealed) return;
    const url = formulation[warm.index]?.audioUrl;
    if (!url) return;
    const audio = new Audio(url);
    modelRef.current = audio;
    audio.play().catch(() => {});
    return () => {
      audio.pause();
    };
  }, [phase, warm.revealed, warm.index, formulation]);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState(false);
  // The take he just made, held here instead of being uploaded on the spot.
  // Until this existed the recording went straight to Storage and he never
  // heard it -- the one pronunciation intervention that works without a
  // teacher, captured and thrown away. `url` is an object URL, revoked below.
  const [take, setTake] = useState<{ blob: Blob; url: string; durationS: number; said: string } | null>(null);
  const [playingTake, setPlayingTake] = useState(false);
  const takeAudioRef = useRef<HTMLAudioElement | null>(null);
  const saidRef = useRef("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);

  // Stop the microphone if the learner leaves mid-recording. A recording
  // indicator left lit in the browser chrome after the page moved on is
  // alarming and entirely our fault.
  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  // Object URLs are not garbage-collected; each take's is released when it is
  // replaced or the stage goes away.
  useEffect(() => {
    const url = take?.url;
    return () => {
      if (url) URL.revokeObjectURL(url);
      takeAudioRef.current?.pause();
    };
  }, [take]);

  const finish = useCallback(
    (blob: Blob | null, durationS: number) => {
      onSpoke(blob, durationS);
      onAdvance();
    },
    [onSpoke, onAdvance],
  );

  // Before the early return: hooks must not be conditional, and this is one.
  const drill = useMemo(
    () => (frame ? buildFrameDrill(frame, frameSeed) : null),
    [frame, frameSeed],
  );

  if (!task || task.script.length === 0) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h1 className="text-3xl font-bold text-ink">{es.session.stages.speak.title}</h1>
          <p className="text-lg text-muted">{es.session.speak.notReady}</p>
        </div>
        <Button type="button" onClick={onAdvance} disabled={pending}>
          {pending ? es.common.loading : isFinal ? es.session.finish : es.session.continue}
        </Button>
      </div>
    );
  }

  const line = task.script[index];
  const isLastLine = index === task.script.length - 1;

  async function startRecording(said: string) {
    saidRef.current = said;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setRecordError(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        // Not finished yet: he gets to hear it first. `finish` runs when he
        // chooses to keep it, from the review screen.
        setTake({
          blob,
          url: URL.createObjectURL(blob),
          durationS: Math.round((Date.now() - startedAtRef.current) / 1000),
          said: saidRef.current,
        });
      };
      recorder.start();
      setRecording(true);
    } catch {
      // Denied, dismissed, no device, insecure context: all the same from here.
      // It blocks nothing, so it does not need to be told apart.
      setRecordError(true);
    }
  }

  function stopRecording() {
    setRecording(false);
    recorderRef.current?.stop();
  }

  function advanceLine() {
    if (isLastLine) {
      // The frame is the last thing, so the recording offer moves with it.
      if (drill) {
        setPhase("frame");
        return;
      }
      finish(null, 0);
      return;
    }
    setIndex((i) => i + 1);
  }

  if (take) {
    const playTake = () => {
      takeAudioRef.current?.pause();
      const audio = new Audio(take.url);
      takeAudioRef.current = audio;
      audio.onended = () => setPlayingTake(false);
      audio.onerror = () => setPlayingTake(false);
      setPlayingTake(true);
      audio.play().catch(() => setPlayingTake(false));
    };
    const again = () => {
      takeAudioRef.current?.pause();
      setPlayingTake(false);
      setTake(null);
    };

    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-base font-medium text-primary">{es.session.speak.reviewTitle}</p>
          <p className="text-3xl font-bold text-balance text-ink">{take.said}</p>
          <p className="text-base text-muted">{es.session.speak.reviewHint}</p>

          <button
            type="button"
            onClick={playTake}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl border-2 border-line bg-surface px-5 py-3 text-lg font-medium text-ink"
          >
            <SpeakerIcon active={playingTake} />
            {playingTake ? es.session.speak.reviewPlaying : es.session.speak.reviewPlay}
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {/* Keeping it is the primary action and is also what saves it; a take
              he re-records is simply replaced, never judged. */}
          <Button
            type="button"
            onClick={() => finish(take.blob, take.durationS)}
            disabled={pending}
          >
            {pending ? es.common.loading : es.session.speak.reviewKeep}
          </Button>
          <button
            type="button"
            onClick={again}
            disabled={pending}
            className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
          >
            {es.session.speak.reviewAgain}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "formulate" && formulation.length > 0) {
    const prompt = formulation[warm.index];
    const isLastPrompt = warm.index === formulation.length - 1;

    const leave = () => {
      modelRef.current?.pause();
      setPhase("script");
    };
    const next = () => {
      if (!isLastPrompt) {
        setWarm({
          round: warm.round,
          index: warm.index + 1,
          started: true,
          revealed: false,
          left: ROUND_SECONDS[warm.round],
        });
        return;
      }
      // Same hand again, tighter clock. The last round ends the phase.
      if (warm.round + 1 < FORMULATION_ROUNDS) {
        setWarm({
          round: warm.round + 1,
          index: 0,
          started: true,
          revealed: false,
          left: ROUND_SECONDS[warm.round + 1],
        });
        return;
      }
      leave();
    };

    if (!warm.started) {
      return (
        <div className="flex flex-1 flex-col gap-6">
          <div className="flex flex-1 flex-col justify-center gap-3">
            <h1 className="text-3xl font-bold text-ink">{es.session.stages.speak.title}</h1>
            <p className="text-lg text-ink">{es.session.speak.formulateIntro}</p>
            <p className="text-base text-muted">{es.session.speak.formulateClock}</p>
          </div>
          <div className="flex flex-col gap-2">
            <Button type="button" onClick={() => setWarm((w) => ({ ...w, started: true }))}>
              {es.session.speak.formulateStart}
            </Button>
            {/* Skippable throughout. A warm-up someone is made to do is a test. */}
            <button
              type="button"
              onClick={leave}
              className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
            >
              {es.session.speak.formulateSkip}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col gap-6">
        <p className="text-base text-faint">
          {fill(es.session.speak.counter, { position: warm.index + 1, total: formulation.length })}
          {" · "}
          {fill(es.session.speak.roundCounter, { round: warm.round + 1, total: FORMULATION_ROUNDS })}
        </p>

        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-base text-muted">{es.session.speak.formulatePrompt}</p>
          <p className="text-3xl font-bold text-balance text-ink">{prompt.es}</p>

          {warm.revealed ? (
            <>
              <p className="text-base font-medium text-primary">{es.session.speak.formulateReveal}</p>
              <p className="text-3xl font-bold text-balance text-ink">{prompt.en}</p>
              {prompt.audioUrl && (
                <p className="text-base text-faint">{es.session.speak.formulateCompare}</p>
              )}
            </>
          ) : (
            // The clock, as a number and nothing else: no red, no bar draining,
            // no sound. It is there to be noticed, not to alarm.
            <p aria-live="polite" className="text-6xl font-bold tabular-nums text-muted">
              {warm.left}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {warm.revealed ? (
            <Button type="button" onClick={next} disabled={pending}>
              {isLastPrompt ? es.session.continue : es.session.speak.formulateNext}
            </Button>
          ) : (
            <Button type="button" onClick={() => setWarm((w) => ({ ...w, revealed: true }))}>
              {es.session.speak.said}
            </Button>
          )}
          <button
            type="button"
            onClick={leave}
            className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
          >
            {es.session.speak.formulateSkip}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "frame" && drill) {
    const selected = drill.options.find((o) => o.key === chosen) ?? null;
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col justify-center gap-4">
          <p className="text-base text-muted">{es.session.speak.frameIntro}</p>

          {selected ? (
            <>
              <p className="text-base font-medium text-primary">{es.session.speak.frameSay}</p>
              <p className="text-3xl font-bold text-balance text-ink">{selected.sentence}</p>
            </>
          ) : (
            <>
              {/* The pattern with a visible blank, so the shape is the thing on
                  screen rather than any one example of it. */}
              <p className="text-3xl font-bold text-balance text-ink">{drill.prompt}</p>
              <p className="text-lg text-muted">{drill.esPattern}</p>
              <ul className="flex flex-col gap-3">
                {drill.options.map((option) => (
                  <li key={option.key}>
                    <button
                      type="button"
                      onClick={() => setChosen(option.key)}
                      className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface px-5 py-3 text-left text-lg text-ink transition-colors"
                    >
                      {option.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- static pictogram
                        <img src={option.imageUrl} alt="" className="h-10 w-10 shrink-0 object-contain" />
                      )}
                      {option.text}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {recordError && <p className="text-base text-faint">{es.session.speak.recordFailed}</p>}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={() => finish(null, 0)}
            disabled={pending || recording || !selected}
          >
            {pending ? es.common.loading : isFinal ? es.session.finish : es.session.continue}
          </Button>

          {/* Choosing again is free and never framed as undoing a mistake --
              a learner who wants to say three of them should. */}
          {selected && !recording && (
            <button
              type="button"
              onClick={() => setChosen(null)}
              disabled={pending}
              className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
            >
              {es.session.speak.frameAnother}
            </button>
          )}

          {selected && !recordError && (
            <button
              type="button"
              onClick={recording ? stopRecording : () => startRecording(selected.sentence)}
              disabled={pending}
              className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
            >
              {recording ? es.session.speak.recordStop : es.session.speak.recordStart}
            </button>
          )}
          {recording && (
            <p className="text-center text-base text-primary">{es.session.speak.recording}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="rounded-2xl border-2 border-line bg-surface px-5 py-4">
        <p className="text-sm font-medium text-faint">{es.session.speak.scenarioLabel}</p>
        <p className="mt-1 text-lg text-ink">{task.scenarioEs}</p>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-4">
        {line.speaker === "ai" ? (
          <>
            <p className="text-base text-muted">
              {fill(es.session.speak.theirTurn, { name: task.characterName })}
            </p>
            {/* No audio: the speaking-task script is not in the audio pipeline
                yet, so their half is read rather than heard. */}
            <p className="text-3xl font-bold text-balance text-ink">{line.en}</p>
            {line.es && <p className="text-lg text-muted">{line.es}</p>}
          </>
        ) : (
          <>
            <p className="text-base font-medium text-primary">{es.session.speak.yourTurn}</p>
            <p className="text-3xl font-bold text-balance text-ink">{line.en}</p>
            {line.es && <p className="text-lg text-muted">{line.es}</p>}
            <p className="text-base text-faint">{es.session.speak.recordHint}</p>
          </>
        )}

        {recordError && <p className="text-base text-faint">{es.session.speak.recordFailed}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Button type="button" onClick={advanceLine} disabled={pending || recording}>
          {pending
            ? es.common.loading
            : isLastLine
              ? isFinal
                ? es.session.finish
                : es.session.continue
              : line.speaker === "user"
                ? es.session.speak.said
                : es.session.continue}
        </Button>

        {/* Offered only on the last line, so one recording covers the attempt
            rather than one per turn -- and only as an alternative to finishing,
            never as a gate in front of it. */}
        {isLastLine && !drill && !recordError && (
          <button
            type="button"
            onClick={recording ? stopRecording : () => startRecording(line.en)}
            disabled={pending}
            className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
          >
            {recording ? es.session.speak.recordStop : es.session.speak.recordStart}
          </button>
        )}
        {isLastLine && !drill && !recording && !recordError && (
          <p className="text-center text-base text-faint">{es.session.speak.recordOptional}</p>
        )}
        {recording && (
          <p className="text-center text-base text-primary">{es.session.speak.recording}</p>
        )}
      </div>
    </div>
  );
}
