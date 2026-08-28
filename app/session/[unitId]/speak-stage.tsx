"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { es, fill } from "@/lib/copy/es";
import type { SpeakTask } from "@/lib/session/speak";

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
 */
export function SpeakStage({
  task,
  pending,
  isFinal,
  onAdvance,
  onSpoke,
}: {
  task: SpeakTask | null;
  pending: boolean;
  isFinal: boolean;
  onAdvance: () => void;
  onSpoke: (blob: Blob | null, durationS: number) => void;
}) {
  const [index, setIndex] = useState(0);
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
      finish(null, 0);
      return;
    }
    setIndex((i) => i + 1);
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
        {isLastLine && !recordError && (
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={pending}
            className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
          >
            {recording ? es.session.speak.recordStop : es.session.speak.recordStart}
          </button>
        )}
        {isLastLine && !recording && !recordError && (
          <p className="text-center text-base text-faint">{es.session.speak.recordOptional}</p>
        )}
        {recording && (
          <p className="text-center text-base text-primary">{es.session.speak.recording}</p>
        )}
      </div>
    </div>
  );
}
