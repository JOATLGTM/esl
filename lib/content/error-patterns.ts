/**
 * Spanish-to-English interference patterns (PRD F6).
 *
 * Data, not logic. `error_events.error_type` is deliberately `text` rather than
 * an enum so that adding a pattern is an edit to the array below and never a
 * migration — the same reason the column was written that way.
 *
 * Every pattern here is a documented L1 transfer from Spanish, not a generic
 * "wrong answer". The point of recording them is that a learner who keeps
 * writing "I have 20 years" is making one mistake many times, not many
 * mistakes — and that is a thing a course can actually address.
 *
 * Two rules for adding one:
 *
 *   1. `key` is stored in the database and must never be reused for a different
 *      meaning. Old rows keep their key forever.
 *   2. `test` matches the *learner's* answer. It only counts as this error when
 *      the expected answer does **not** also match, which is what stops a
 *      pattern firing on a correct answer that happens to contain the shape.
 */

export type ErrorPattern = {
  key: string;
  /** For a future "these are your patterns" screen. Spanish, like all learner copy. */
  labelEs: string;
  test: RegExp;
};

export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    // "Tengo 20 años" -> "I have 20 years". The most recognisable one.
    key: "have_years_for_age",
    labelEs: "La edad en inglés usa «to be», no «to have»: I am 20, no I have 20.",
    test: /\b(i|he|she|we|they|you)\s+(have|has)\s+\d+\s+years?\b/,
  },
  {
    // The same `tener` rule as the age one, and the reason that one is not
    // enough: Spanish uses *tener* for states English expresses with *be*, so
    // one L1 rule generates a whole family of errors -- tengo hambre, tengo
    // sed, tengo sueño, tengo frío. Reachable from b1_u6, which teaches
    // "I am hungry" and "It is cold".
    //
    // `hunger`, `thirst` and `sleep` as bare nouns after have/has are
    // unambiguous. `cold` and `hot` are NOT -- "I have cold water" and "I have
    // hot coffee" are perfectly good English -- so those two only match at the
    // end of the sentence, where no noun can follow them.
    key: "have_state_for_be",
    labelEs: "Estos estados usan «to be»: I am hungry, no I have hunger.",
    test: /\b(i|he|she|we|they|you)\s+(?:have|has)\s+(?:(?:hunger|thirst|sleep)\b|(?:cold|hot)\s*[.!?]*$)/,
  },
  {
    // Spanish drops the subject pronoun; English cannot.
    key: "dropped_subject",
    labelEs: "En inglés el sujeto no se puede omitir: I am fine, no Am fine.",
    test: /^(am|is|are|was|were)\b/,
  },
  {
    // "Soy estudiante" -> "I am student".
    key: "missing_article",
    labelEs: "Falta el artículo: I am a student, no I am student.",
    test: /\b(am|is|are)\s+(student|teacher|doctor|nurse|waiter|driver|cook)\b/,
  },
  {
    // Third person -s, which Spanish marks on the verb differently.
    key: "missing_third_person_s",
    labelEs: "En tercera persona el verbo lleva -s: he works, no he work.",
    test: /\b(he|she|it)\s+(go|work|live|have|do|say|come|want|need|like|speak)\b/,
  },
  {
    // "Explícame" -> "explain me".
    key: "missing_preposition_to",
    labelEs: "Se dice explain to me, no explain me.",
    test: /\b(explain|say|speak)\s+(me|him|her|us|them)\b/,
  },
  {
    // "La gente es" -> "people is". Spanish treats it as singular.
    key: "people_is",
    labelEs: "People es plural en inglés: people are, no people is.",
    test: /\bpeople\s+is\b/,
  },
  {
    // Question without do-support: "¿Qué quieres?" -> "What you want?"
    key: "missing_do_support",
    labelEs: "Las preguntas necesitan do o does: What do you want?",
    test: /^(what|where|when|why|how)\s+(you|he|she|we|they)\s+\w+/,
  },
  {
    // Adjective after the noun, as in Spanish.
    key: "adjective_after_noun",
    labelEs: "En inglés el adjetivo va antes: a red car, no a car red.",
    test: /\b(a|an|the)\s+\w+\s+(red|blue|green|big|small|new|old|good|bad)\b/,
  },
];

/**
 * Which pattern a wrong answer fits, if any.
 *
 * Returns null for an answer that is simply a different phrase — most wrong
 * answers are, and inventing a category for them would bury the real signal.
 *
 * The `expected` guard is what keeps a pattern from firing on the correct
 * answer: "he goes to work" contains no third-person error, but a naive regex
 * over "the red car" would match `adjective_after_noun` in a phrase that is
 * perfectly correct.
 */
export function classifyError(expected: string, actual: string): string | null {
  const want = normaliseForMatch(expected);
  const got = normaliseForMatch(actual);
  if (!got) return null;

  for (const pattern of ERROR_PATTERNS) {
    // `test` carries no /g flag, so `lastIndex` never persists between calls.
    if (pattern.test.test(got) && !pattern.test.test(want)) return pattern.key;
  }
  return null;
}

function normaliseForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}
