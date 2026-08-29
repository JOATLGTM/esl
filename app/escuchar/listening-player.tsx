"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SpeakerIcon } from "@/components/ui/speaker-icon";
import { SpeedControl, type Speed } from "@/components/ui/speed-control";
import { es } from "@/lib/copy/es";
import { activeLineAt } from "@/lib/session/transcript";
import type { ListeningTrack } from "@/lib/session/listening";

/**
 * The library player. The same shape as Absorb's -- one audio element for the
 * whole track, the playing line lit, any line tappable to replay just that
 * line from the authored timings -- with two differences that follow from what
 * a library is for:
 *
 *   - **A speed control** (`components/ui/speed-control.tsx`), shared with
 *     Absorb.
 *   - **Nothing after it.** No questions, no shadowing, no advance. It ends
 *     and he picks another one or leaves.
 */
export function ListeningPlayer({ track }: { track: ListeningTrack }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopAtRef = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [speed, setSpeed] = useState<Speed>(1);

  useEffect(() => {
    if (!track.audioUrl) return;
    const audio = new Audio(track.audioUrl);
    audio.preservesPitch = true;
    audioRef.current = audio;
    const onTime = () => {
      const ms = audio.currentTime * 1000;
      setElapsedMs(ms);
      if (stopAtRef.current !== null && ms >= stopAtRef.current) {
        audio.pause();
        stopAtRef.current = null;
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onPause);
    audio.addEventListener("error", onPause);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onPause);
      audio.removeEventListener("error", onPause);
    };
  }, [track.audioUrl]);

  // Applied whenever it changes, including mid-play.
  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed]);

  const playFrom = useCallback((startMs: number, stopMs: number | null) => {
    const audio = audioRef.current;
    if (!audio) return;
    stopAtRef.current = stopMs;
    audio.currentTime = startMs / 1000;
    void audio.play().catch(() => setPlaying(false));
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    playFrom(audio.ended ? 0 : audio.currentTime * 1000, null);
  }

  const activeLine = activeLineAt(track.lines, playing ? elapsedMs : null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={toggle} disabled={!track.audioUrl}>
          <span className="flex items-center gap-2">
            <SpeakerIcon active={playing} />
            {playing ? es.listening.pause : es.listening.play}
          </span>
        </Button>
        <SpeedControl value={speed} onChange={setSpeed} />
      </div>

      {!track.audioUrl && <p className="text-base text-faint">{es.listening.noAudio}</p>}

      <ol className="flex flex-col gap-3">
        {track.lines.map((line, i) => (
          <li key={`${line.character}-${i}`}>
            <button
              type="button"
              onClick={() => playFrom(line.startMs, line.endMs)}
              disabled={!track.audioUrl}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition-colors ${
                activeLine === i ? "border-primary bg-primary-soft" : "border-line bg-surface"
              }`}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-faint">
                {line.portraitUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- static portrait
                  <img src={line.portraitUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                )}
                {line.name}
              </span>
              <span className="block text-lg text-ink">{line.en}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
