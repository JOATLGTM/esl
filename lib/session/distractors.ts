/**
 * Wrong answers for a recognition card.
 *
 * Pure, and separated out because getting this wrong is invisible in review and
 * brutal in use. The original version drew distractors from whatever was due
 * today, which on day one is the six greetings Meet had just introduced in
 * curriculum order — so the very first question of the very first session
 * offered "Hola" and "Hola (informal)" as competing answers for *Hello*, in
 * 34.5% of seeds. A beginner picks the wrong one, is marked wrong, and has the
 * card reset, on a distinction that does not exist in Spanish.
 *
 * Two rules follow from that:
 *
 *   1. **Never offer two glosses a learner could not tell apart.** A distractor
 *      is only a distractor if choosing it is a real mistake.
 *   2. **Rather show fewer options than a bad one.** Three options with one
 *      confusable pair is worse than two clean ones.
 */

/**
 * The part of a gloss that carries meaning.
 *
 * `es_gloss` often carries disambiguating metadata in parentheses — "Hola
 * (informal)", "Buenas noches (al despedirse)". That parenthetical is written
 * for the *author*, to keep two chunks apart in the file. To a learner reading
 * three options it is either invisible or a tell, and never the thing being
 * tested.
 */
function baseGloss(gloss: string): string {
  return gloss
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether two glosses are too close to be offered together.
 *
 * Equal base forms ("Hola" / "Hola (informal)") are the case that shipped. The
 * containment check catches the same class one step out — "Buenas noches" and
 * "Buenas noches y hasta mañana" differ by an adverbial nobody is being tested
 * on.
 */
export function confusable(a: string, b: string): boolean {
  const x = baseGloss(a);
  const y = baseGloss(b);
  if (!x || !y) return true;
  if (x === y) return true;
  return x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

export type Options = { values: string[]; answer: number };

/**
 * The correct gloss plus up to `count` distractors, in a seeded order.
 *
 * `pool` should be every gloss the learner has met, not just the ones due
 * today: a pool drawn from one session's worth of new chunks is
 * semantically clustered by construction, because a unit introduces greetings
 * together, then farewells together, and so on.
 *
 * Returns fewer options rather than repeating one. The old version indexed
 * `others[(start + 1) % others.length]` without checking the length, so a pool
 * with exactly one usable distractor produced the same wrong answer twice —
 * and a duplicate React key with it.
 */
export function buildOptions(
  seed: string,
  correct: string,
  pool: readonly string[],
  count = 2,
): Options {
  const usable = [...new Set(pool)].filter(
    (gloss) => gloss !== correct && !confusable(gloss, correct),
  );

  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  // Walk the pool from a seeded offset, skipping anything confusable with what
  // has already been picked, so the distractors are distinguishable from each
  // other as well as from the answer.
  const picked: string[] = [];
  const start = usable.length > 0 ? (h >>> 0) % usable.length : 0;
  for (let i = 0; i < usable.length && picked.length < count; i++) {
    const candidate = usable[(start + i) % usable.length];
    if (picked.some((chosen) => confusable(chosen, candidate))) continue;
    picked.push(candidate);
  }

  const values = [correct, ...picked];
  const offset = (h >>> 8) % values.length;
  const rotated = [...values.slice(offset), ...values.slice(0, offset)];
  return { values: rotated, answer: rotated.indexOf(correct) };
}

/**
 * Whether a recognition card can be built at all.
 *
 * One option is not a question. A card with no usable distractor should be
 * asked another way rather than served as a multiple choice with a single
 * button.
 */
export function canBuildRecognition(correct: string, pool: readonly string[]): boolean {
  return pool.some((gloss) => gloss !== correct && !confusable(gloss, correct));
}
