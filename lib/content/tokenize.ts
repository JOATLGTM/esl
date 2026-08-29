/**
 * Tokenizer shared by the readability gate, the validator, and the runtime
 * known-word set. It must stay deterministic: if authoring and runtime disagree
 * on what a token is, a scene that validated at build time can fail the 95%
 * gate for a real user.
 */

/**
 * Contractions expand to their parts so that `I'm` counts as knowing `I` and
 * `am`, and so a learner who has `I am` on a card is credited for `I'm`.
 * This mirrors the fuzzy-match rule in PRD F2 (`I am` ~= `I'm`).
 */
const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ["i", "am"],
  "you're": ["you", "are"],
  "he's": ["he", "is"],
  "she's": ["she", "is"],
  "it's": ["it", "is"],
  "we're": ["we", "are"],
  "they're": ["they", "are"],
  "that's": ["that", "is"],
  "what's": ["what", "is"],
  "where's": ["where", "is"],
  "who's": ["who", "is"],
  "how's": ["how", "is"],
  "there's": ["there", "is"],
  "here's": ["here", "is"],
  "let's": ["let", "us"],
  "i've": ["i", "have"],
  "you've": ["you", "have"],
  "we've": ["we", "have"],
  "they've": ["they", "have"],
  "i'll": ["i", "will"],
  "you'll": ["you", "will"],
  "he'll": ["he", "will"],
  "she'll": ["she", "will"],
  "we'll": ["we", "will"],
  "they'll": ["they", "will"],
  "i'd": ["i", "would"],
  "you'd": ["you", "would"],
  "he'd": ["he", "would"],
  "she'd": ["she", "would"],
  "we'd": ["we", "would"],
  "they'd": ["they", "would"],
  "don't": ["do", "not"],
  "doesn't": ["does", "not"],
  "didn't": ["did", "not"],
  "isn't": ["is", "not"],
  "aren't": ["are", "not"],
  "wasn't": ["was", "not"],
  "weren't": ["were", "not"],
  "can't": ["can", "not"],
  "couldn't": ["could", "not"],
  "won't": ["will", "not"],
  "wouldn't": ["would", "not"],
  "shouldn't": ["should", "not"],
  "haven't": ["have", "not"],
  "hasn't": ["has", "not"],
  "hadn't": ["had", "not"],
};

/** Strip a leading `A:` / `Ana:` speaker label from a transcript line. */
export function stripSpeakerLabel(line: string): string {
  return line.replace(/^\s*[A-Z][A-Za-zÁÉÍÓÚÑáéíóúñ]{0,14}\s*:\s*/, "");
}

/**
 * Split English text into comparable word tokens.
 *
 * - lowercased, punctuation stripped
 * - apostrophes preserved long enough to expand contractions
 * - digits dropped (numerals aren't vocabulary; the words for them are)
 */
export function tokenize(text: string): string[] {
  const out: string[] = [];
  const raw = text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .split(/[^a-z']+/);

  for (const piece of raw) {
    const word = piece.replace(/^'+|'+$/g, "");
    if (!word) continue;
    const expanded = CONTRACTIONS[word];
    if (expanded) out.push(...expanded);
    else out.push(word);
  }
  return out;
}

/** Tokenize a multi-line, speaker-labelled transcript (English lines only). */
export function tokenizeTranscript(transcript: string): string[] {
  return transcript
    .split("\n")
    .map(stripSpeakerLabel)
    .flatMap(tokenize);
}

/**
 * Regular English inflections a learner who knows the base form can decode.
 * Used only to match against a known-word set — never to *add* words to it.
 */
/**
 * Words whose trailing letters look like an inflection and are not.
 *
 * `his` is not the plural of `hi`, and `its` is not the plural of `it` -- but
 * both bases are taught in unit 1, so stripping the `s` credited the learner
 * for two distinct high-frequency function words they had never met. The same
 * goes for `was`, `yes`, `this` and `bus`. Every one of these silently
 * *inflated* readability, which is the direction that matters: a scene passed
 * the 95% gate while containing words the learner did not have.
 *
 * Length is not a usable rule here -- `cars`, `eyes` and `days` are the same
 * size as `his` and are genuine plurals -- so this is a list, kept short and
 * confined to words frequent enough to matter.
 */
const NEVER_DECOMPOSED = new Set([
  "his", "its", "this", "was", "has", "is", "as", "us", "yes", "does", "goes",
  "bus", "gas", "less", "class", "press", "always", "perhaps", "news",
]);

export function morphologicalVariants(word: string): string[] {
  const v = new Set<string>([word]);
  if (NEVER_DECOMPOSED.has(word)) return [...v];
  const add = (s: string) => { if (s.length > 1) v.add(s); };

  if (word.endsWith("s")) {
    add(word.slice(0, -1));
    if (word.endsWith("es")) add(word.slice(0, -2));
    if (word.endsWith("ies")) add(word.slice(0, -3) + "y");
  }
  if (word.endsWith("ed")) {
    add(word.slice(0, -2));
    add(word.slice(0, -1));
    if (word.endsWith("ied")) add(word.slice(0, -3) + "y");
  }
  if (word.endsWith("ing")) {
    add(word.slice(0, -3));
    add(word.slice(0, -3) + "e");
  }
  return [...v];
}
