import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { morphologicalVariants } from "./tokenize";

/**
 * Cognate resolution (PRD F4).
 *
 * For an A0-A2 Spanish speaker, a transparent Latinate cognate is free
 * comprehension. Counting those as known is what makes the 95% gate reachable
 * with a beginner-sized word list. The rules below stay conservative on
 * purpose: a false positive here serves a learner an item they cannot read,
 * which is the exact failure the gate exists to prevent.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");

/** Suffix rules never fire below this length -- `al`, `ic` etc. are too greedy. */
const MIN_SUFFIX_RULE_LENGTH = 5;

type SuffixRule = { en: string; es: string; note: string };

export type CognateData = {
  suffixRules: SuffixRule[];
  curated: Map<string, string>;
  falseFriends: Map<string, { looks_like: string; really_means_es: string }>;
  properNouns: Set<string>;
};

let cache: CognateData | null = null;

export function loadCognateData(contentDir = CONTENT_DIR): CognateData {
  if (cache) return cache;

  const cognates = YAML.parse(
    fs.readFileSync(path.join(contentDir, "wordlists", "cognates.yaml"), "utf8")
  );
  const proper = YAML.parse(
    fs.readFileSync(path.join(contentDir, "wordlists", "proper-nouns.yaml"), "utf8")
  );

  cache = {
    suffixRules: cognates.suffix_rules as SuffixRule[],
    curated: new Map(
      (cognates.curated as { en: string; es: string }[]).map((c) => [c.en.toLowerCase(), c.es])
    ),
    falseFriends: new Map(
      (cognates.false_friends as { en: string; looks_like: string; really_means_es: string }[])
        .map((f) => [f.en.toLowerCase(), { looks_like: f.looks_like, really_means_es: f.really_means_es }])
    ),
    properNouns: new Set(
      [...(proper.names ?? []), ...(proper.places ?? [])].map((n: string) => n.toLowerCase())
    ),
  };
  return cache;
}

/** Test-seam: drop the module-level cache. */
export function resetCognateCache(): void {
  cache = null;
}

export type CognateVerdict =
  | { cognate: false; reason: "unknown" | "false_friend" }
  | { cognate: true; via: "curated" | "suffix" | "proper_noun"; es?: string };

/**
 * Is this token free for a Spanish L1 reader?
 *
 * Precedence is deliberate: false friends beat everything, because a learner
 * who "recognizes" *embarrassed* has understood the sentence backwards.
 */
export function classifyCognate(token: string, data = loadCognateData()): CognateVerdict {
  const word = token.toLowerCase();

  if (data.falseFriends.has(word)) return { cognate: false, reason: "false_friend" };
  if (data.properNouns.has(word)) return { cognate: true, via: "proper_noun" };

  for (const variant of morphologicalVariants(word)) {
    if (data.falseFriends.has(variant)) return { cognate: false, reason: "false_friend" };
    const curated = data.curated.get(variant);
    if (curated) return { cognate: true, via: "curated", es: curated };
  }

  if (word.length >= MIN_SUFFIX_RULE_LENGTH) {
    for (const rule of data.suffixRules) {
      if (word.endsWith(rule.en)) {
        return { cognate: true, via: "suffix", es: word.slice(0, -rule.en.length) + rule.es };
      }
    }
  }

  return { cognate: false, reason: "unknown" };
}

export function isCognate(token: string, data = loadCognateData()): boolean {
  return classifyCognate(token, data).cognate;
}
