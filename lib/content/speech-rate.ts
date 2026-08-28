/**
 * How fast the generated voices actually speak.
 *
 * `content/voices.yaml` declares `rate_wpm` per voice and
 * `lib/content/tts-providers.ts` passes it to the engine. Nothing checked that
 * the engine listened — and macOS `say` did not: it accepts `-r 155` and
 * ignores it, so the committed audio ran 90–136 wpm against a declared 150–160,
 * and in one scene Ana (132) alternated with Miguel (98), leaving the learner's
 * own in-story counterpart sounding like a different species of English.
 *
 * That is what moved the project to Piper on 2026-08-28. Piper has no
 * words-per-minute setting either, but it has `length_scale`, so the rate is at
 * least *controllable*; `natural_wpm` in the roster is the per-model
 * calibration that turns a target into a scale. After the switch every voice
 * lands within 6% of its declared rate and the spread across the cast is 1.10x.
 * This check is what keeps that true.
 *
 * The pipeline already proves the voices are *distinct* — that guard exists
 * because Block 1 once shipped with three names for Samantha. Distinctness is
 * not the same as appropriateness, and this is the missing half: a voice can be
 * unmistakably its own and still be wrong for the job.
 *
 * Pure, so the thresholds can be argued with in a test rather than discovered
 * by a learner.
 */

export type RateClip = {
  voiceId: string;
  text: string;
  durationMs: number;
  kind: string;
  /** Scene id for `scene_line` clips; used to compare speakers within one conversation. */
  ownerId: string;
};

/**
 * Shortest clip worth measuring, in words.
 *
 * A clip carries fixed overhead that is not speech: head and tail silence from
 * the encoder, a pause at a comma, ~0.2s at a sentence boundary. At 150 wpm an
 * utterance lasts words/2.5 seconds, so that ~0.3s of overhead is **19% of a
 * four-word clip and 12% of a six-word one** — measured against the real
 * manifest, four-word lines like "Tom, I'm from Mexico." report 104 wpm for a
 * voice averaging 162.
 *
 * Six is where the measurement starts describing speech rather than packaging,
 * while still leaving ~29 clips across five voices to measure. Eight would be
 * cleaner and leaves eight clips total, which is not a measurement.
 */
export const MIN_WORDS = 6;

/**
 * The band a teaching voice should sit in.
 *
 * Natural conversational English is roughly 150–190 wpm; deliberate
 * teacher-talk sits near 130. Below ~115 the reductions and linking that make
 * English hard to hear stop happening at all, so the learner is trained on a
 * register no stranger will ever use. Above ~185 an A0 beginner is not
 * listening, they are enduring.
 *
 * Wide on purpose: this is a floor for "obviously wrong", not a house style.
 */
export const MIN_WPM = 115;
export const MAX_WPM = 185;

/**
 * How far measured may drift from declared before the roster is lying.
 *
 * This is the check that catches an ignored `-r` flag, which is the actual bug:
 * every voice declared 150–160 and the pipeline reported success while
 * producing 90.
 */
export const DECLARED_TOLERANCE = 0.2;

/**
 * How much two speakers in one conversation may differ.
 *
 * Real people vary, so this is not 1.0. But past about a quarter it stops
 * reading as two people and starts reading as two recordings — and the learner
 * has no way to know the difference is an artefact rather than something about
 * the character.
 */
export const MAX_SCENE_SPREAD = 1.25;

export type VoiceRate = {
  voiceId: string;
  wpm: number;
  samples: number;
  declaredWpm?: number;
};

function wordsIn(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Clips long enough for their duration to mean something. */
function measurable(clips: readonly RateClip[]): RateClip[] {
  return clips.filter((c) => c.durationMs > 0 && wordsIn(c.text) >= MIN_WORDS);
}

/** Mean words-per-minute per voice, over clips long enough to measure. */
export function measureVoiceRates(
  clips: readonly RateClip[],
  declared: ReadonlyMap<string, number | undefined> = new Map(),
): VoiceRate[] {
  const byVoice = new Map<string, number[]>();
  for (const clip of measurable(clips)) {
    const wpm = wordsIn(clip.text) / (clip.durationMs / 60_000);
    if (!byVoice.has(clip.voiceId)) byVoice.set(clip.voiceId, []);
    byVoice.get(clip.voiceId)!.push(wpm);
  }

  return [...byVoice.entries()]
    .map(([voiceId, rates]) => ({
      voiceId,
      wpm: rates.reduce((a, b) => a + b, 0) / rates.length,
      samples: rates.length,
      declaredWpm: declared.get(voiceId),
    }))
    .sort((a, b) => a.wpm - b.wpm);
}

export type SceneSpread = {
  sceneId: string;
  slowest: VoiceRate;
  fastest: VoiceRate;
  ratio: number;
};

/**
 * Fewest measurable clips a voice needs *within one scene* before its rate
 * there is worth comparing to anyone else's.
 *
 * The voice-level check already refuses to accuse on fewer than three samples;
 * the scene-level one used to have no such guard, which is how `s_0006` was
 * flagged at 1.33x on the strength of two short Miguel lines from a voice whose
 * overall rate was within 5% of target. Thin evidence is not evidence.
 */
export const MIN_SCENE_SAMPLES = 3;

/**
 * The widest gap between two speakers inside a single conversation.
 *
 * Scoped per scene rather than globally because this is about what the learner
 * hears in one sitting: two units may reasonably differ, two characters
 * answering each other may not.
 */
export function measureSceneSpreads(clips: readonly RateClip[]): SceneSpread[] {
  const byScene = new Map<string, RateClip[]>();
  for (const clip of clips) {
    if (clip.kind !== "scene_line") continue;
    if (!byScene.has(clip.ownerId)) byScene.set(clip.ownerId, []);
    byScene.get(clip.ownerId)!.push(clip);
  }

  return [...byScene.entries()]
    .flatMap(([sceneId, sceneClips]) => {
      const rates = measureVoiceRates(sceneClips).filter(
        (rate) => rate.samples >= MIN_SCENE_SAMPLES,
      );
      if (rates.length < 2) return [];
      const slowest = rates[0];
      const fastest = rates[rates.length - 1];
      return [{ sceneId, slowest, fastest, ratio: fastest.wpm / slowest.wpm }];
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export type RateProblem = { where: string; message: string; detail: string };

/**
 * Everything wrong with the speech rate of a generated set, as reportable
 * problems. Empty when the audio is fine — or when there is none yet.
 */
export function rateProblems(
  clips: readonly RateClip[],
  declared: ReadonlyMap<string, number | undefined>,
): RateProblem[] {
  const problems: RateProblem[] = [];

  for (const rate of measureVoiceRates(clips, declared)) {
    // Too few samples to accuse anyone of anything.
    if (rate.samples < 3) continue;

    if (rate.wpm < MIN_WPM || rate.wpm > MAX_WPM) {
      problems.push({
        where: `voice:${rate.voiceId}`,
        message: `speaks at ${Math.round(rate.wpm)} wpm`,
        detail: `outside ${MIN_WPM}-${MAX_WPM}; below the floor the linking and reductions that make English hard to hear stop happening at all`,
      });
    }

    if (rate.declaredWpm) {
      const drift = Math.abs(rate.wpm - rate.declaredWpm) / rate.declaredWpm;
      if (drift > DECLARED_TOLERANCE) {
        problems.push({
          where: `voice:${rate.voiceId}`,
          message: `declares ${rate.declaredWpm} wpm but speaks at ${Math.round(rate.wpm)}`,
          detail: "the engine is ignoring the rate the roster asks for",
        });
      }
    }
  }

  for (const spread of measureSceneSpreads(clips)) {
    if (spread.ratio > MAX_SCENE_SPREAD) {
      problems.push({
        where: `scene:${spread.sceneId}`,
        message: `${spread.fastest.voiceId} speaks ${spread.ratio.toFixed(2)}x faster than ${spread.slowest.voiceId}`,
        detail: `${Math.round(spread.fastest.wpm)} vs ${Math.round(spread.slowest.wpm)} wpm in one conversation`,
      });
    }
  }

  return problems;
}
