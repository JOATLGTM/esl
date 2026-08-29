"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakerIcon } from "@/components/ui/speaker-icon";
import { es } from "@/lib/copy/es";
import { matchesQuery, type PhraseGroup } from "@/lib/session/phrasebook";

/**
 * The shelf. A search box, the groups, a play button per phrase. Search is
 * client-side over both languages -- he may remember the Spanish and need
 * the English, which is the whole point.
 */
export function Phrasebook({ groups }: { groups: PhraseGroup[] }) {
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  function play(id: string, url: string) {
    audioRef.current?.pause();
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlaying(null);
    audio.onerror = () => setPlaying(null);
    setPlaying(id);
    audio.play().catch(() => setPlaying(null));
  }

  const visible = groups
    .map((g) => ({ ...g, phrases: g.phrases.filter((p) => matchesQuery(p, query)) }))
    .filter((g) => g.phrases.length > 0);

  const labels = es.phrasebook.groups as Record<string, string>;

  return (
    <div className="flex flex-col gap-6">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-faint">{es.phrasebook.search}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={es.phrasebook.searchHint}
          autoComplete="off"
          className="min-h-12 rounded-2xl border-2 border-line bg-surface px-4 text-lg text-ink"
        />
      </label>

      {visible.length === 0 && <p className="text-base text-faint">{es.phrasebook.noMatch}</p>}

      {visible.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2 className="text-xl font-bold text-ink">{labels[g.key] ?? g.key}</h2>
          <ul className="flex flex-col gap-2">
            {g.phrases.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => p.audioUrl && play(p.id, p.audioUrl)}
                  disabled={!p.audioUrl}
                  className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 border-line bg-surface px-4 py-2 text-left"
                >
                  <SpeakerIcon active={playing === p.id} />
                  <span className="flex flex-col">
                    <span className="text-lg text-ink">{p.en}</span>
                    <span className="text-base text-muted">{p.es}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
