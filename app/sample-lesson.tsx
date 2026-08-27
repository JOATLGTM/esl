"use client";

import { useEffect, useRef, useState } from "react";
import { es } from "@/lib/copy/es";

/**
 * Thirty seconds of the real thing, before signup (PRD 7).
 *
 * Not a marketing mock-up: these are chunks out of Block 1 Unit 1, with the
 * audio the pipeline generated, in the layout Stage 2 (Meet) actually uses. The
 * pitch is "you will be able to say this", and the fastest way to make that
 * credible is to let someone hear it while they are still deciding.
 */
export type SampleChunk = { id: string; en: string; es: string; url: string | null };

export function SampleLesson({ chunks }: { chunks: SampleChunk[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Stop audio if the component goes away mid-clip -- otherwise a learner who
    // taps through to signup keeps hearing a voice from a page that is gone.
    return () => audioRef.current?.pause();
  }, []);

  function play(chunk: SampleChunk) {
    if (!chunk.url) return;
    audioRef.current?.pause();
    const audio = new Audio(chunk.url);
    audioRef.current = audio;
    setPlaying(chunk.id);
    audio.onended = () => setPlaying(null);
    // Autoplay policy, a dead file, a flaky connection: all the same here.
    // Nothing is broken from the learner's side, so nothing should look broken.
    audio.onerror = () => setPlaying(null);
    void audio.play().catch(() => setPlaying(null));
  }

  if (chunks.length === 0) {
    return <p className="text-base text-faint">{es.landing.noSample}</p>;
  }

  return (
    <section className="flex flex-col gap-3" aria-label={es.landing.samplePrompt}>
      <p className="text-base font-medium text-muted">{es.landing.samplePrompt}</p>
      <ul className="flex flex-col gap-2">
        {chunks.map((chunk) => (
          <li key={chunk.id}>
            <button
              type="button"
              onClick={() => play(chunk)}
              disabled={!chunk.url}
              className="flex min-h-16 w-full items-center gap-4 rounded-2xl border-2 border-line
                bg-surface px-5 py-3 text-left transition-colors hover:border-primary
                disabled:opacity-60"
            >
              <SpeakerIcon active={playing === chunk.id} />
              <span className="flex flex-col">
                <span className="text-lg font-semibold text-ink">{chunk.en}</span>
                <span className="text-base text-muted">{chunk.es}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-faint">{es.landing.sampleHint}</p>
    </section>
  );
}

function SpeakerIcon({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
        active ? "bg-primary text-primary-ink" : "bg-primary-soft text-primary"
      }`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.2"
           strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H3v6h3l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
    </span>
  );
}
