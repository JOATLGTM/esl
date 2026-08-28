"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { recordDrill } from "../actions";
import { Button } from "@/components/ui/button";
import { es, fill } from "@/lib/copy/es";
import type { EarDrill } from "@/lib/session/ear";

/**
 * Stage 1, Ear: two words that sound identical to a Spanish ear until they do
 * not.
 *
 * Never framed as a test. Being wrong here is the normal state for weeks -- the
 * whole point is that the category has not formed yet -- so there is no score,
 * and the clip replays on a wrong answer so the learner hears the difference at
 * the moment they are told about it.
 */
export function EarStage({
  drill,
  pending,
  onAdvance,
}: {
  drill: EarDrill | null;
  pending: boolean;
  onAdvance: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<"a" | "b" | null>(null);
  const [, startTransition] = useTransition();
  const resultsRef = useRef<boolean[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((url: string) => {
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    void audio.play().catch(() => {});
  }, []);

  const item = drill?.items[index];

  // Play each item as it appears; hearing it is the question.
  useEffect(() => {
    if (item) play(item.url);
  }, [item, play]);

  useEffect(() => () => audioRef.current?.pause(), []);

  if (!drill || !item) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h1 className="text-3xl font-bold text-ink">{es.session.stages.ear.title}</h1>
          <p className="text-lg text-muted">{es.session.ear.notReady}</p>
        </div>
        <Button type="button" onClick={onAdvance} disabled={pending}>
          {pending ? es.common.loading : es.session.continue}
        </Button>
      </div>
    );
  }

  const { contrast, items } = drill;
  const current = item;
  const answered = choice !== null;
  const correct = choice === current.target;
  const isLast = index === items.length - 1;

  function answer(picked: "a" | "b") {
    setChoice(picked);
    resultsRef.current = [...resultsRef.current, picked === current.target];
    // Hear it again alongside being told which it was. Reading the answer
    // teaches nothing about a sound.
    play(current.url);
  }

  function next() {
    if (isLast) {
      // Written once for the whole drill: the retirement rule reads a trailing
      // window, so a partial drill still folds in correctly.
      const results = resultsRef.current;
      startTransition(async () => {
        await recordDrill({ contrast, results });
      });
      onAdvance();
      return;
    }
    setIndex((i) => i + 1);
    setChoice(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-base text-faint">
        {fill(es.session.ear.counter, { position: index + 1, total: items.length })}
      </p>

      <div className="flex flex-1 flex-col justify-center gap-5">
        <p className="text-lg text-muted">{es.session.ear.prompt}</p>

        <div className="flex gap-3">
          {(["a", "b"] as const).map((side) => {
            const word = side === "a" ? current.wordA : current.wordB;
            const ipa = side === "a" ? current.ipaA : current.ipaB;
            const isTarget = side === current.target;
            return (
              <button
                key={side}
                type="button"
                disabled={answered}
                onClick={() => answer(side)}
                className={`flex min-h-24 flex-1 flex-col items-center justify-center rounded-2xl border-2 px-4 py-3 transition-colors ${
                  answered && isTarget
                    ? "border-primary bg-primary-soft"
                    : "border-line bg-surface hover:border-faint"
                } disabled:cursor-default`}
              >
                <span className="text-2xl font-bold text-ink">{word}</span>
                <span className="text-base text-faint">{ipa}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => play(current.url)}
          className="min-h-11 self-start text-base font-medium text-muted underline underline-offset-4"
        >
          {es.session.ear.replay}
        </button>

        {answered && (
          <p className="text-lg text-muted">
            {correct ? es.session.ear.right : es.session.ear.wrong}
          </p>
        )}
      </div>

      <Button type="button" onClick={next} disabled={!answered || pending}>
        {pending ? es.common.loading : isLast ? es.session.continue : es.session.ear.next}
      </Button>
    </div>
  );
}
