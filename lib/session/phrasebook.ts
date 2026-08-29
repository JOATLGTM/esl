/**
 * The phrasebook (`docs/ROADMAP.md` #8): every phrase the learner has met,
 * grouped by the situation he will be standing in when he needs it.
 *
 * He is surrounded by English he cannot use, and until this existed his
 * phrases only existed inside a lesson -- locked behind `current_unit` and
 * the day's stage. This is the shelf: searchable, out of curriculum order,
 * with audio, one tap from `/home`.
 *
 * Grouping is by tag, but a *situation*, not a grammar category, because that
 * is how he will look for it: "I'm at the counter", not "ordering". The repair
 * strategies are pinned first. Failure to understand is guaranteed; the only
 * variable is whether he can stay in the conversation, and those four phrases
 * are worth more than any vocabulary set.
 *
 * Pure grouping here; the loader is in `phrasebook-server.ts`.
 */

export type Phrase = {
  id: string;
  en: string;
  es: string;
  audioUrl: string | null;
  tags: string[];
};

export type PhraseGroup = {
  key: string;
  /** Spanish heading, from `es.phrasebook.groups`. */
  phrases: Phrase[];
};

/**
 * Situations, in the order they are shown, each claiming the tags listed.
 * A phrase goes in the first situation that claims one of its tags, so the
 * order here is also the priority: a chunk tagged both `repair` and
 * `question` is a repair phrase.
 */
export const SITUATIONS: { key: string; tags: string[] }[] = [
  { key: "repair", tags: ["repair", "attention", "language"] },
  { key: "greet", tags: ["greeting", "farewell", "introduction", "presenting", "polite", "courtesy", "origin"] },
  { key: "numbers", tags: ["numbers", "phone", "age"] },
  { key: "people", tags: ["family", "people"] },
  { key: "street", tags: ["places", "directions"] },
  { key: "work", tags: ["work", "time", "days", "time_of_day"] },
  { key: "cafe", tags: ["ordering", "food", "giving"] },
  { key: "feelings", tags: ["feeling", "describing"] },
];
export const OTHER_GROUP = "other";

export function groupPhrases(phrases: readonly Phrase[]): PhraseGroup[] {
  const groups = new Map<string, Phrase[]>();
  for (const s of SITUATIONS) groups.set(s.key, []);
  groups.set(OTHER_GROUP, []);

  for (const p of phrases) {
    const home = SITUATIONS.find((s) => s.tags.some((t) => p.tags.includes(t)))?.key ?? OTHER_GROUP;
    groups.get(home)!.push(p);
  }

  return [...groups.entries()]
    .filter(([, list]) => list.length > 0)
    .map(([key, list]) => ({
      key,
      // Alphabetical inside a group: he is scanning for a phrase he half
      // remembers, and curriculum order means nothing at a counter.
      phrases: [...list].sort((a, b) => a.en.localeCompare(b.en)),
    }));
}

/** Case- and accent-insensitive match on either language. */
export function matchesQuery(p: Phrase, query: string): boolean {
  const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = fold(query.trim());
  if (!q) return true;
  return fold(p.en).includes(q) || fold(p.es).includes(q);
}
