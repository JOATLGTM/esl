import type { ReviewMode, Tables } from "@/lib/supabase/types";

/**
 * Which mode a card is due in. Pure, and separated from the server-only
 * loader so the ladder can be argued with in a test.
 *
 * The ladder (PRD F2, plus ROADMAP v2 #7):
 *
 *   - **First sight is recognition.** The card was met minutes ago; asking a
 *     beginner to reproduce it cold teaches them they are bad at this.
 *   - **Everything after is typed production**, because recognition passes do
 *     not count toward mastery and a card only ever recognised never matures.
 *   - **A learned card with audio comes back as dictation**: hear it, type
 *     it. This is the one exercise that forces bottom-up parsing of connected
 *     speech -- word boundaries, weak forms, contractions -- which is exactly
 *     the failure mode of a syllable-timed L1 hearing a stress-timed
 *     language, and which nothing else in the loop touches (Absorb keeps the
 *     transcript on screen throughout). Learned cards only: dictation cannot
 *     mature a card (`countsAsProduction` refuses it), so putting it earlier
 *     would stall the ladder; on mastered material it is a listening check on
 *     phrases the learner already owns.
 */
export function modeFor(
  card: Pick<Tables<"user_cards">, "reps" | "state">,
  hasAudio: boolean,
): ReviewMode {
  if (card.reps === 0) return "recognize";
  if (card.state === "learned" && hasAudio) return "dictation";
  return "produce_typed";
}
