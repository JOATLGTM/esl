import "server-only";
import { createEmptyCard, fsrs, type Card, type Grade } from "ts-fsrs";
import { cardStateFor, countsAsProduction, ratingFor, type TypedOutcome } from "./grade";
import { createClient } from "@/lib/supabase/server";
import type { ChunkAudio, ReviewMode, Tables } from "@/lib/supabase/types";

/**
 * Stage 4, Retrieve (PRD 4.2 / F2): the spaced-repetition queue.
 *
 * The scheduler is FSRS, and `user_cards` stores its fields under their own
 * names on purpose — a card round-trips through `ts-fsrs` untranslated, so
 * there is no mapping layer to get subtly wrong when the library is upgraded.
 * There is no `ease` column because FSRS models memory as stability plus
 * difficulty and never computes one.
 *
 * Reviews are written one at a time rather than batched at the end of the
 * stage. A learner who closes the tab after eight of twelve cards keeps eight
 * reviews; batching would throw them away, and in a spaced-repetition system
 * the review history *is* the product.
 */

const scheduler = fsrs();

export type ReviewCard = {
  chunkId: string;
  en: string;
  es: string;
  exampleEn: string;
  audioUrl: string | null;
  mode: ReviewMode;
  /** Recognition only: the correct gloss plus distractors, already shuffled. */
  options: string[];
  answer: number;
};

/**
 * Reviews to attempt in one session, from the daily goal.
 *
 * Higher than the new-chunk budget because a review is a few seconds and a new
 * phrase is a minute, and because the queue has to drain faster than Meet fills
 * it or it grows without bound.
 */
export function reviewBudget(dailyGoalMinutes: number): number {
  switch (dailyGoalMinutes) {
    case 10:
      return 8;
    case 30:
      return 24;
    default:
      return 15;
  }
}

/**
 * Which mode a card is due in.
 *
 * The first sight of a card is recognition — it was met minutes ago and asking
 * a beginner to reproduce it cold is how you teach them they are bad at this.
 * Everything after that is production, because recognition passes do not count
 * toward mastery and a card that is only ever recognised never matures.
 */
export function modeFor(card: Pick<Tables<"user_cards">, "reps">): ReviewMode {
  return card.reps === 0 ? "recognize" : "produce_typed";
}

/** The FSRS half of a `user_cards` row, in the library's own shape. */
function toFsrsCard(row: Tables<"user_cards">): Card {
  return {
    due: new Date(row.due_at),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.fsrs_state,
    last_review: row.last_review_at ? new Date(row.last_review_at) : undefined,
  } as Card;
}

/**
 * The cards due now, newest-due first, capped at the session's budget.
 *
 * Deliberately not filtered to the current unit. A learner in unit 3 still owes
 * reviews from unit 1, and a queue that only ever shows the unit you are in is
 * not a spaced-repetition system, it is a quiz at the end of a chapter.
 */
export async function loadDueCards(
  userId: string,
  budget: number,
  seed: string,
): Promise<ReviewCard[]> {
  const supabase = await createClient();

  const { data: due } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", userId)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(budget);

  if (!due || due.length === 0) return [];

  const { data: chunks } = await supabase
    .from("chunks")
    .select("id, en_text, es_gloss, example_en, audio_urls")
    .in(
      "id",
      due.map((card) => card.chunk_id),
    );

  const byId = new Map((chunks ?? []).map((chunk) => [chunk.id, chunk]));

  // Distractors for recognition come from the learner's own cards, so the wrong
  // answers are phrases they have actually met. Options drawn from unseen
  // vocabulary are eliminable on sight and test nothing.
  const glossPool = (chunks ?? []).map((chunk) => chunk.es_gloss);

  return due.flatMap((card, i) => {
    const chunk = byId.get(card.chunk_id);
    if (!chunk) return [];

    const mode = modeFor(card);
    const options =
      mode === "recognize"
        ? buildOptions(`${seed}:${card.chunk_id}`, chunk.es_gloss, glossPool)
        : { values: [] as string[], answer: 0 };

    return [
      {
        chunkId: chunk.id,
        en: chunk.en_text,
        es: chunk.es_gloss,
        exampleEn: chunk.example_en,
        // Alternating voices across the queue, so a review session is not one
        // talker for twelve cards.
        audioUrl: ((chunk.audio_urls as ChunkAudio[] | null) ?? [])[i % 2]?.url ?? null,
        mode,
        options: options.values,
        answer: options.answer,
      },
    ];
  });
}

/** The correct gloss and up to two distractors, in a seeded order. */
function buildOptions(
  seed: string,
  correct: string,
  pool: string[],
): { values: string[]; answer: number } {
  const others = [...new Set(pool)].filter((gloss) => gloss !== correct);

  // Seeded pick, so a refresh does not reshuffle the answers mid-question.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const start = others.length > 0 ? (h >>> 0) % others.length : 0;
  const picked = [others[start], others[(start + 1) % others.length]].filter(Boolean);

  const values = [correct, ...picked];
  // Rotate rather than shuffle: enough to move the answer off slot one, which
  // is the whole failure mode, and cheap to reason about.
  const offset = (h >>> 8) % values.length;
  const rotated = [...values.slice(offset), ...values.slice(0, offset)];
  return { values: rotated, answer: rotated.indexOf(correct) };
}

/**
 * Record one review and reschedule the card.
 *
 * Everything the scheduler owns comes straight back out of `ts-fsrs`; the two
 * things it does not know about are `produce_passes` (mastery is production,
 * not recall) and `state` (the product's notion of maturity). Nothing here may
 * write `learned` on its own judgement — `cardStateFor` claims it only with two
 * production passes behind it, which is also what the database will accept.
 */
export async function applyReview(
  userId: string,
  chunkId: string,
  mode: ReviewMode,
  outcome: TypedOutcome,
  now: Date = new Date(),
): Promise<void> {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("user_cards")
    .select("*")
    .eq("user_id", userId)
    .eq("chunk_id", chunkId)
    .maybeSingle();

  // No card means the chunk was never met, which the client cannot reach
  // legitimately. Nothing to reschedule.
  if (!row) return;

  const scheduled = scheduler.next(
    row.reps === 0 && row.fsrs_state === 0 ? createEmptyCard(now) : toFsrsCard(row),
    now,
    ratingFor(outcome) as Grade,
  ).card;

  const producePasses = row.produce_passes + (countsAsProduction(mode, outcome) ? 1 : 0);

  await supabase
    .from("user_cards")
    .update({
      due_at: scheduled.due.toISOString(),
      stability: scheduled.stability,
      difficulty: scheduled.difficulty,
      elapsed_days: scheduled.elapsed_days,
      scheduled_days: scheduled.scheduled_days,
      learning_steps: scheduled.learning_steps,
      reps: scheduled.reps,
      lapses: scheduled.lapses,
      fsrs_state: scheduled.state,
      last_review_at: now.toISOString(),
      produce_passes: producePasses,
      state: cardStateFor(producePasses, scheduled.state),
      last_mode: mode,
      updated_at: now.toISOString(),
    })
    .eq("user_id", userId)
    .eq("chunk_id", chunkId);
}
