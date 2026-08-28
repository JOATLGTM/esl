import "server-only";
import { pickSceneIndex, shuffleQuestion, type Question } from "./quiz";
import { createClient } from "@/lib/supabase/server";
import type { SceneQuestion, TranscriptSegment } from "@/lib/supabase/types";

/**
 * Stage 3, Absorb (PRD 4.2 / F4): one scene from the unit's story, then three
 * questions about it.
 *
 * The scene is a conversation the learner can very nearly follow already -- the
 * 95% rule doing its work -- so the stage is comprehension, not decoding. Which
 * is why the transcript is on screen the whole time and every line is tappable:
 * the failure mode to design against is a learner who misses one word, loses
 * the thread, and sits through forty seconds of noise.
 */

export type AbsorbLine = {
  /** Character id, for the key; `name` is what the learner reads. */
  character: string;
  name: string;
  en: string;
  es?: string;
  startMs: number;
  endMs: number;
};

export type AbsorbScene = {
  id: string;
  titleEs: string;
  audioUrl: string | null;
  lines: AbsorbLine[];
  questions: Question[];
  /** Which scene of how many, so the learner can see the story has a shape. */
  position: number;
  total: number;
};

/**
 * The scene this session plays, with its questions already shuffled.
 *
 * `seed` fixes the option order for the sitting -- pass the session id, so a
 * refresh mid-question does not rearrange the answers under the learner.
 */
export async function loadAbsorbScene(
  userId: string,
  unitId: string,
  seed: string,
): Promise<AbsorbScene | null> {
  const supabase = await createClient();

  const [scenes, completed, characters] = await Promise.all([
    supabase
      .from("scenes")
      .select("id, title_es, audio_url, transcript, questions")
      .eq("unit_id", unitId)
      .order("id", { ascending: true }),
    // Sessions already finished in this unit. The current one is still open, so
    // this number is stable for its whole duration -- the page and a later
    // reload agree about which scene is playing.
    supabase
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("unit_id", unitId)
      .not("completed_at", "is", null),
    supabase.from("characters").select("id, name"),
  ]);

  const all = scenes.data ?? [];
  if (all.length === 0) return null;

  const index = pickSceneIndex(completed.count ?? 0, all.length);
  const scene = all[index];

  const names = new Map((characters.data ?? []).map((c) => [c.id, c.name]));
  const transcript = (scene.transcript as TranscriptSegment[] | null) ?? [];

  return {
    id: scene.id,
    titleEs: scene.title_es,
    audioUrl: scene.audio_url,
    lines: transcript.map((line) => ({
      character: line.character,
      // An unknown speaker cannot reach the database -- the validator rejects a
      // transcript tag that is not in the cast -- but a name is not worth a
      // crash, so fall back to the id rather than rendering "undefined:".
      name: names.get(line.character) ?? line.character,
      en: line.en,
      es: line.es,
      startMs: line.start_ms,
      endMs: line.end_ms,
    })),
    questions: ((scene.questions as SceneQuestion[] | null) ?? []).map((q, i) =>
      shuffleQuestion(`${seed}:${scene.id}:${i}`, {
        // Spanish at A0-A1, English from A2 -- the taper (PRD 4.5). The content
        // carries whichever it was authored with; this picks what is there.
        prompt: q.q_es ?? q.q_en ?? "",
        options: q.options_es ?? q.options_en ?? [],
        answer: q.answer,
      }),
    ),
    position: index + 1,
    total: all.length,
  };
}
