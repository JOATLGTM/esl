"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { es, fill } from "@/lib/copy/es";
import type { SpeakTask } from "@/lib/session/speak";
import { buildFrameDrill, type SessionFrame } from "@/lib/session/frame-drill";

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
 * The stage runs in two phases. First the script, which is recall: the exact
 * line is on screen. Then, if the unit has a frame, the learner builds a
 * sentence of their own from a pattern -- the first thing in the whole product
 * that nobody wrote for them. The frame comes second on purpose: producing
 * something new is easier right after saying five things that worked.
 */
export function SpeakStage({
  task,
  frame,
  frameSeed,
  pending,
  isFinal,
  onAdvance,
  onSpoke,
}: {
  task: SpeakTask | null;
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
  const [phase, setPhase] = useState<"script" | "frame">("script");
  const [chosen, setChosen] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState(false);
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

  async function startRecording() {
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
        finish(blob, Math.round((Date.now() - startedAtRef.current) / 1000));
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
                      className="flex min-h-16 w-full items-center rounded-2xl border-2 border-line bg-surface px-5 py-3 text-left text-lg text-ink transition-colors"
                    >
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
              onClick={recording ? stopRecording : startRecording}
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
            onClick={recording ? stopRecording : startRecording}
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
