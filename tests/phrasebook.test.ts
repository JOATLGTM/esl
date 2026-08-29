import assert from "node:assert/strict";
import { test, describe } from "node:test";

import { OTHER_GROUP, SITUATIONS, groupPhrases, matchesQuery, type Phrase } from "../lib/session/phrasebook";

const p = (id: string, en: string, es: string, tags: string[]): Phrase => ({ id, en, es, audioUrl: null, tags });

describe("groupPhrases", () => {
  test("repair strategies come first, whatever else they are tagged", () => {
    const groups = groupPhrases([
      p("c1", "Thank you", "Gracias", ["polite"]),
      p("c2", "Can you repeat that?", "¿Puede repetirlo?", ["question", "repair"]),
    ]);
    assert.equal(groups[0].key, "repair");
    assert.deepEqual(groups[0].phrases.map((x) => x.id), ["c2"]);
  });

  test("a phrase lands in the first situation that claims one of its tags", () => {
    const [g] = groupPhrases([p("c1", "Where is the café?", "¿Dónde está el café?", ["question", "places"])]);
    assert.equal(g.key, "street");
  });

  test("an unclaimed tag falls to the catch-all rather than vanishing", () => {
    const [g] = groupPhrases([p("c1", "Okay", "Está bien", ["answer"])]);
    assert.equal(g.key, OTHER_GROUP);
  });

  test("empty groups are not shown", () => {
    const groups = groupPhrases([p("c1", "Hello", "Hola", ["greeting"])]);
    assert.deepEqual(groups.map((g) => g.key), ["greet"]);
  });

  test("inside a group, alphabetical -- curriculum order means nothing at a counter", () => {
    const [g] = groupPhrases([
      p("c9", "Water, please", "Agua, por favor", ["ordering"]),
      p("c1", "A small coffee", "Un café pequeño", ["ordering"]),
    ]);
    assert.deepEqual(g.phrases.map((x) => x.id), ["c1", "c9"]);
  });

  test("every situation key has a heading in the copy", async () => {
    const { es } = await import("../lib/copy/es");
    const labels = es.phrasebook.groups as Record<string, string>;
    for (const s of SITUATIONS) assert.ok(labels[s.key], `no heading for ${s.key}`);
    assert.ok(labels[OTHER_GROUP]);
  });
});

describe("matchesQuery", () => {
  const phrase = p("c1", "I don't understand", "No entiendo", ["repair"]);
  test("matches either language", () => {
    assert.ok(matchesQuery(phrase, "understand"));
    assert.ok(matchesQuery(phrase, "entiendo"));
  });
  test("ignores case and accents -- he may type without them", () => {
    assert.ok(matchesQuery(p("c2", "Where is the café?", "¿Dónde está?", []), "cafe"));
    assert.ok(matchesQuery(p("c2", "Where is the café?", "¿Dónde está?", []), "donde esta"));
  });
  test("an empty query matches everything", () => {
    assert.ok(matchesQuery(phrase, "   "));
  });
});
