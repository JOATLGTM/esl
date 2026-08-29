"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { recordShadowing } from "../actions";
import { Button } from "@/components/ui/button";
import { SpeedControl, type Speed } from "@/components/ui/speed-control";
import { es, fill } from "@/lib/copy/es";
import type { AbsorbScene } from "@/lib/session/absorb";
import {
  SHADOW_STAGES,
  nextShadowStage,
  pickShadowSegment,
  type ShadowStage,
} from "@/lib/session/shadowing";
import { activeLineAt } from "@/lib/session/transcript";

/**
 * Stage 3, Absorb (PRD 4.2 / F4): listen to the scene, then answer three
 * questions about it.
 *
 * The transcript is on screen throughout and every line is tappable. That is
 * the whole design: a learner who misses one word must be able to get it back
 * in one tap, because the alternative is losing the thread and sitting through
 * forty seconds of noise. The sentence timings this needs are authored into
 * `scenes.transcript`, so replaying a line is a seek, not a second file.
 *
 * Questions come after listening, one at a time, and are never scored. A wrong
 * answer shows the right one and moves on. Shadowing (PRD F11) follows, on
 * material the learner has just proved they understood -- and is skippable,
 * because speaking out loud in a room where someone might hear is not always
 * possible.
 */
export function AbsorbStage({
  scene,
  pending,
  onAdvance,
}: {
  scene: AbsorbScene;
  pending: boolean;
  onAdvance: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Where a single-line replay should stop. Null means "play to the end".
  const stopAtRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [heard, setHeard] = useState(false);
  const [quiz, setQuiz] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [speed, setSpeed] = useState<Speed>(1);
  // Shadowing (PRD F11) runs after the questions, on material the learner has
  // just proved they understood.
  const [shadowStage, setShadowStage] = useState<ShadowStage | null>(null);
  const [, startTransition] = useTransition();

  // One element for the whole scene, created once. Recreating it per play would
  // refetch a 50-second file on every line tap.
  useEffect(() => {
    if (!scene.audioUrl) return;
    const audio = new Audio(scene.audioUrl);
    audioRef.current = audio;

    const onTime = () => {
      const ms = audio.currentTime * 1000;
      setElapsedMs(ms);
      // A line replay stops itself; the scene otherwise runs to its end.
      if (stopAtRef.current !== null && ms >= stopAtRef.current) {
        audio.pause();
        stopAtRef.current = null;
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setHeard(true);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onPause);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onPause);
    };
  }, [scene.audioUrl]);

  // Applied whenever it changes, including mid-line. Pitch is preserved so a
  // slower Maria is still Maria and not a different, lower voice.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.preservesPitch = true;
    audio.playbackRate = speed;
  }, [speed, scene.audioUrl]);

  const playFrom = useCallback((startMs: number, stopMs: number | null) => {
    const audio = audioRef.current;
    if (!audio) return;
    stopAtRef.current = stopMs;
    audio.currentTime = startMs / 1000;
    void audio.play().catch(() => setPlaying(false));
  }, []);

  function toggleScene() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    // Restarting from the top once it has finished, rather than resuming from
    // an ended position, which plays nothing.
    playFrom(audio.ended ? 0 : audio.currentTime * 1000, null);
  }

  // Only while the audio is actually running. At rest `elapsedMs` is 0, which
  // sits inside the first line, so a paused scene would open with line one lit
  // as though it were already playing.
  const activeLine = activeLineAt(scene.lines, playing ? elapsedMs : null);

  const shadowSegment = pickShadowSegment(scene.lines, scene.id);

  /* ----------------------------------------------------------- shadowing -- */

  if (shadowStage && shadowSegment) {
    const instruction =
      shadowStage === "listen"
        ? es.session.absorb.shadowListen
        : shadowStage === "repeat"
          ? es.session.absorb.shadowRepeat
          : es.session.absorb.shadowShadow;

    const finishStage = () => {
      startTransition(async () => {
        await recordShadowing({
          sceneId: scene.id,
          segmentIndex: shadowSegment.index,
          stage: shadowStage,
        });
      });
      const next = nextShadowStage(shadowStage);
      if (next) {
        setShadowStage(next);
        return;
      }
      onAdvance();
    };

    return (
      <div className="flex flex-1 flex-col gap-6">
        <p className="text-base text-faint">
          {fill(es.session.absorb.shadowCounter, {
            position: SHADOW_STAGES.indexOf(shadowStage) + 1,
            total: SHADOW_STAGES.length,
          })}
        </p>

        <div className="flex flex-1 flex-col justify-center gap-5">
          <h1 className="text-2xl font-bold text-ink">{es.session.absorb.shadowTitle}</h1>
          <p className="text-lg text-muted">{instruction}</p>
          <p className="text-3xl font-bold text-balance text-ink">{shadowSegment.en}</p>

          <Button
            type="button"
            variant="secondary"
            onClick={() => playFrom(shadowSegment.startMs, shadowSegment.endMs)}
          >
            {es.session.absorb.shadowPlay}
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" onClick={finishStage} disabled={pending}>
            {pending ? es.common.loading : es.session.absorb.shadowDone}
          </Button>
          {/* Skippable at any point. The microphone is optional forever, and so
              is speaking out loud in a room where someone might hear. */}
          <button
            type="button"
            onClick={onAdvance}
            className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
          >
            {es.session.absorb.shadowSkip}
          </button>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- quiz -- */

  if (quiz && scene.questions.length > 0) {
    const question = scene.questions[questionIndex];
    const answered = choice !== null;
    const correct = choice === question.answer;
    const isLastQuestion = questionIndex === scene.questions.length - 1;

    return (
      <div className="flex flex-1 flex-col gap-6">
        <p className="text-base text-faint">
          {fill(es.session.absorb.questionCounter, {
            position: questionIndex + 1,
            total: scene.questions.length,
          })}
        </p>

        <div className="flex flex-1 flex-col justify-center gap-5">
          <h1 className="text-2xl font-bold text-balance text-ink">{question.prompt}</h1>

          <ul className="flex flex-col gap-3">
            {question.options.map((option, i) => {
              const isAnswer = i === question.answer;
              const picked = choice === i;
              return (
                <li key={option}>
                  <button
                    type="button"
                    disabled={answered}
                    onClick={() => setChoice(i)}
                    className={`flex min-h-16 w-full items-center rounded-2xl border-2 px-5 py-3 text-left text-lg transition-colors ${
                      answered && isAnswer
                        ? "border-primary bg-primary-soft text-ink"
                        : picked
                          ? "border-line bg-surface text-muted"
                          : "border-line bg-surface text-ink hover:border-faint"
                    } disabled:cursor-default`}
                  >
                    {option}
                  </button>
                </li>
              );
            })}
          </ul>

          {answered && (
            <p className="text-lg text-muted">
              {correct ? es.session.absorb.right : es.session.absorb.wrong}
            </p>
          )}
        </div>

        <Button
          type="button"
          disabled={!answered || pending}
          onClick={() => {
            if (isLastQuestion) {
              // Shadowing only when the scene has a line worth shadowing and
              // audio to shadow along with; otherwise the stage is done.
              if (shadowSegment && scene.audioUrl) {
                setShadowStage("listen");
                return;
              }
              onAdvance();
              return;
            }
            setQuestionIndex((i) => i + 1);
            setChoice(null);
          }}
        >
          {pending
            ? es.common.loading
            : isLastQuestion
              ? es.session.continue
              : es.session.absorb.nextQuestion}
        </Button>
      </div>
    );
  }

  /* -------------------------------------------------------------- listen -- */

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold text-ink">{scene.titleEs}</h1>
        <p className="shrink-0 text-base text-faint">
          {fill(es.session.absorb.sceneCounter, {
            position: scene.position,
            total: scene.total,
          })}
        </p>
      </div>

      {scene.audioUrl ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={toggleScene}>
              {playing
                ? es.session.absorb.stop
                : heard
                  ? es.session.absorb.playAgain
                  : es.session.absorb.play}
            </Button>
            <SpeedControl value={speed} onChange={setSpeed} />
          </div>
          <p className="text-base text-faint">{es.session.absorb.tapHint}</p>
        </>
      ) : (
        <p className="text-base text-faint">{es.session.absorb.noAudio}</p>
      )}

      <ol className="flex flex-1 flex-col gap-2">
        {scene.lines.map((line, i) => (
          <li key={`${line.character}-${i}`}>
            <button
              type="button"
              disabled={!scene.audioUrl}
              onClick={() => playFrom(line.startMs, line.endMs)}
              className={`w-full rounded-xl border-2 px-4 py-2 text-left transition-colors ${
                i === activeLine
                  ? "border-primary bg-primary-soft"
                  : "border-transparent hover:border-line"
              } disabled:cursor-default`}
            >
              <span className="text-sm font-semibold text-faint">{line.name}</span>
              <span className="block text-lg text-ink">{line.en}</span>
              {line.es && <span className="block text-base text-muted">{line.es}</span>}
            </button>
          </li>
        ))}
      </ol>

      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          audioRef.current?.pause();
          if (scene.questions.length === 0) {
            if (shadowSegment && scene.audioUrl) {
              setShadowStage("listen");
              return;
            }
            onAdvance();
            return;
          }
          setQuiz(true);
        }}
      >
        {pending ? es.common.loading : es.session.absorb.toQuestions}
      </Button>
    </div>
  );
}
