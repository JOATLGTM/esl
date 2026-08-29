"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpeakerIcon } from "@/components/ui/speaker-icon";
import { es, fill } from "@/lib/copy/es";
import type { MeetChunk } from "@/lib/session/meet";

/**
 * Stage 2, Meet (PRD 4.2): meeting new phrases, one at a time.
 *
 * One phrase per screen, not a list. A list invites skimming, and skimming is
 * how a beginner arrives at Retrieve having read six phrases and learned none.
 * It also means the English is the biggest thing on the screen, which is the
 * point of the stage.
 *
 * The Spanish is behind a tap. That is not decoration: `user_cards.gloss_reveals`
 * is what later notices a learner who is quietly not ready and offers to step
 * the Spanish taper back a level (PRD F2). A gloss printed next to every phrase
 * would make that number meaningless, because everyone reads it.
 *
 * Nothing here can be got wrong, so nothing here is scored.
 */
export function MeetStage({
  chunks,
  offerGloss,
  pending,
  onAdvance,
}: {
  chunks: MeetChunk[];
  /**
   * Whether the Spanish is offered at all (PRD 4.6, the taper).
   *
   * Only the least-supported level withdraws it. The audio, the replays and
   * the example sentence are identical either way -- what tapers is the
   * translation and nothing else.
   */
  offerGloss: boolean;
  pending: boolean;
  onAdvance: (revealedChunkIds: string[]) => void;
}) {
  // One cursor, not two pieces of state: moving to the next phrase must also
  // go back to its first voice, and as separate state that reset has to happen
  // in an effect -- a cascading render, and one the lint rule rightly refuses.
  const [cursor, setCursor] = useState({ index: 0, voice: 0 });
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { index, voice } = cursor;
  const chunk = chunks[index];
  const isLast = index === chunks.length - 1;

  const play = useCallback((url: string) => {
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    // Driven by the element's own events rather than set when we ask, so the
    // icon reflects audio that is actually playing -- and so nothing writes
    // state synchronously inside the autoplay effect below.
    audio.onplay = () => setPlaying(true);
    audio.onended = () => setPlaying(false);
    audio.onpause = () => setPlaying(false);
    // A blocked autoplay, a dead file, a flaky connection: all the same from
    // here. Nothing is broken from the learner's side, so nothing looks broken.
    audio.onerror = () => setPlaying(false);
    void audio.play().catch(() => setPlaying(false));
  }, []);

  // Play the phrase when it appears. The learner tapped to get into this stage,
  // so the page already has the gesture autoplay policies want -- and if a
  // browser disagrees, `play()` swallows it and the button still works.
  useEffect(() => {
    const url = chunks[index]?.voices[0]?.url;
    if (url) play(url);
  }, [index, chunks, play]);

  // Stop the audio if the stage goes away mid-clip, so a voice does not carry
  // on over the next screen.
  useEffect(() => () => audioRef.current?.pause(), []);

  if (!chunk) return null;

  const voices = chunk.voices;
  const current = voices[voice] ?? voices[0];

  function reveal() {
    setRevealed((seen) => new Set(seen).add(chunk.id));
  }

  function nextVoice() {
    // Wrapping rather than stopping at the end: the point is hearing the same
    // phrase in more than one mouth, and which one is next does not matter.
    const next = (voice + 1) % voices.length;
    setCursor((c) => ({ ...c, voice: next }));
    if (voices[next]) play(voices[next].url);
  }

  function next() {
    if (isLast) {
      onAdvance([...revealed]);
      return;
    }
    setCursor((c) => ({ index: c.index + 1, voice: 0 }));
  }

  const isRevealed = revealed.has(chunk.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <p className="text-base text-faint">
        {fill(es.session.meet.counter, { position: index + 1, total: chunks.length })}
      </p>

      <div className="flex flex-1 flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-bold text-balance text-ink">{chunk.en}</h1>

          {!offerGloss ? null : isRevealed ? (
            <p className="text-xl text-muted">{chunk.es}</p>
          ) : (
            <button
              type="button"
              onClick={reveal}
              className="self-start rounded-full px-1 text-lg font-medium text-primary underline underline-offset-4"
            >
              {es.session.meet.reveal}
            </button>
          )}
        </div>

        {current ? (
          <div className="flex flex-col gap-3">
            <Button type="button" variant="secondary" onClick={() => play(current.url)}>
              <SpeakerIcon active={playing} />
              {es.session.meet.listen}
            </Button>
            {voices.length > 1 && (
              <button
                type="button"
                onClick={nextVoice}
                className="min-h-11 text-base font-medium text-muted underline underline-offset-4"
              >
                {es.session.meet.otherVoice}
                <span className="text-faint">
                  {" · "}
                  {fill(es.session.meet.voiceCount, {
                    position: voice + 1,
                    total: voices.length,
                  })}
                  {/* The accent is named only when it is actually different.
                      Hearing that "Hello" is the same word in a British mouth is
                      the lesson; printing "US (General American)" under three
                      consecutive US voices is noise that hides it. */}
                  {current.accent !== voices[0].accent && ` · ${current.accent}`}
                </span>
              </button>
            )}
          </div>
        ) : (
          <p className="text-base text-faint">{es.session.meet.noAudio}</p>
        )}

        <div className="rounded-2xl border-2 border-line bg-surface px-5 py-4">
          <p className="text-sm font-medium text-faint">{es.session.meet.example}</p>
          <p className="mt-1 text-lg text-ink">{chunk.exampleEn}</p>
          {offerGloss && isRevealed && (
            <p className="text-base text-muted">{chunk.exampleEs}</p>
          )}
        </div>
      </div>

      <Button type="button" onClick={next} disabled={pending}>
        {pending ? es.common.loading : isLast ? es.session.continue : es.session.meet.next}
      </Button>
    </div>
  );
}

