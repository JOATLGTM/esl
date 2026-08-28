"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { reviewCard } from "../actions";
import { Button } from "@/components/ui/button";
import { es, fill } from "@/lib/copy/es";
import { gradeTypedAnswer, type TypedOutcome } from "@/lib/session/grade";
import type { ReviewCard } from "@/lib/session/retrieve";

/**
 * Stage 4, Retrieve (PRD 4.2 / F2): the review queue.
 *
 * The only stage where a learner can be wrong, which makes the wording and the
 * colour choices carry more weight than the logic. There is no score, no
 * counter of mistakes, nothing red, and a wrong answer is answered by showing
 * the phrase rather than by echoing what they typed back at them. "No me
 * acuerdo" is a first-class button, not a penalty — admitting you have
 * forgotten is the correct move in a spaced-repetition system, and burying it
 * teaches guessing.
 *
 * Each answer is sent as it happens rather than batched at the end, so closing
 * the tab halfway keeps half the reviews.
 */
export function RetrieveStage({
  cards,
  pending,
  isFinal,
  onAdvance,
}: {
  cards: ReviewCard[];
  pending: boolean;
  isFinal: boolean;
  onAdvance: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState("");
  const [outcome, setOutcome] = useState<TypedOutcome | null>(null);
  const [, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const card = cards[index];
  const isLastCard = index === cards.length - 1;

  const play = useCallback((url: string | null) => {
    if (!url) return;
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    void audio.play().catch(() => {});
  }, []);

  useEffect(() => () => audioRef.current?.pause(), []);

  if (!card) {
    // A legitimate state, and the system working rather than a gap: everything
    // the learner knows is scheduled for a day that is not today.
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h1 className="text-3xl font-bold text-ink">{es.session.retrieve.nothingDue}</h1>
          <p className="text-lg text-muted">{es.session.retrieve.nothingDueBody}</p>
        </div>
        <Button type="button" onClick={onAdvance} disabled={pending}>
          {pending ? es.common.loading : isFinal ? es.session.finish : es.session.continue}
        </Button>
      </div>
    );
  }

  const answered = outcome !== null;

  function settle(result: TypedOutcome) {
    setOutcome(result);
    // Hearing the phrase at the moment of being told the answer is the point;
    // reading it silently is how it stays unpronounceable.
    play(card.audioUrl);
    // Fire-and-continue: the learner is already reading the feedback, and the
    // write must not make them wait for a round trip.
    startTransition(async () => {
      await reviewCard({
        chunkId: card.chunkId,
        mode: card.mode,
        outcome: result,
        // Sent whenever the answer was not exact, not only when it was marked
        // wrong. Nothing is stored unless it fits a known transfer pattern.
        typed: card.mode === "produce_typed" && result !== "correct" ? typed : undefined,
      });
    });
  }

  function next() {
    if (isLastCard) {
      onAdvance();
      return;
    }
    setIndex((i) => i + 1);
    setTyped("");
    setOutcome(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-base text-faint">
        {fill(es.session.retrieve.counter, { position: index + 1, total: cards.length })}
      </p>

      <div className="flex flex-1 flex-col justify-center gap-5">
        {card.mode === "recognize" ? (
          <>
            <p className="text-base text-muted">{es.session.retrieve.recognizePrompt}</p>
            <h1 className="text-4xl font-bold text-balance text-ink">{card.en}</h1>

            <ul className="flex flex-col gap-3">
              {card.options.map((option, i) => {
                const isAnswer = i === card.answer;
                return (
                  <li key={option}>
                    <button
                      type="button"
                      disabled={answered}
                      onClick={() => settle(i === card.answer ? "correct" : "wrong")}
                      className={`flex min-h-16 w-full items-center rounded-2xl border-2 px-5 py-3 text-left text-lg transition-colors ${
                        answered && isAnswer
                          ? "border-primary bg-primary-soft text-ink"
                          : "border-line bg-surface text-ink hover:border-faint"
                      } disabled:cursor-default`}
                    >
                      {option}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <>
            <p className="text-base text-muted">{es.session.retrieve.producePrompt}</p>
            <h1 className="text-3xl font-bold text-balance text-ink">{card.es}</h1>

            <input
              ref={inputRef}
              type="text"
              value={typed}
              disabled={answered}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !answered && typed.trim()) {
                  settle(gradeTypedAnswer(card.en, typed));
                }
              }}
              aria-label={es.session.retrieve.inputLabel}
              // Autocorrect and autocapitalise off: the phone helpfully
              // "fixing" a beginner's English is the app marking its own answer.
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="min-h-14 w-full rounded-2xl border-2 border-line bg-surface px-5 text-xl text-ink outline-none focus:border-primary disabled:opacity-70"
            />
          </>
        )}

        {answered && (
          <div className="flex flex-col gap-1">
            <p className="text-lg text-muted">
              {outcome === "correct"
                ? es.session.retrieve.right
                : outcome === "close"
                  ? es.session.retrieve.almost
                  : es.session.retrieve.wrong}
            </p>
            {outcome !== "correct" && (
              <p className="text-2xl font-semibold text-ink">{card.en}</p>
            )}
            <p className="text-base text-faint">{card.exampleEn}</p>
          </div>
        )}
      </div>

      {answered ? (
        <Button type="button" onClick={next} disabled={pending}>
          {pending
            ? es.common.loading
            : isLastCard
              ? isFinal
                ? es.session.finish
                : es.session.continue
              : es.session.retrieve.next}
        </Button>
      ) : card.mode === "produce_typed" ? (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={!typed.trim()}
            onClick={() => settle(gradeTypedAnswer(card.en, typed))}
          >
            {es.session.retrieve.check}
          </Button>
          {/* Forgetting is a legitimate answer, and the scheduler needs to be
              told the truth about it. Hidden behind a "give up" framing, it
              would just teach guessing. */}
          <button
            type="button"
            onClick={() => settle("wrong")}
            className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
          >
            {es.session.retrieve.skip}
          </button>
        </div>
      ) : null}
    </div>
  );
}
