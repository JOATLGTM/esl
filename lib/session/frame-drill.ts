/**
 * The frame step of Stage 5, Speak (PRD 4.2 / 4.5).
 *
 * A frame is a pattern with one slot -- `I'd like {NP}, please.` -- and this is
 * the first place in the product where the learner produces a sentence nobody
 * wrote for them. Everything before it is recall: Meet shows a phrase, Retrieve
 * asks for it back, and the scripted half of Speak puts the exact line on
 * screen. Here they choose what goes in the hole, and the sentence that comes
 * out is theirs.
 *
 * That is the whole point of the type existing. A course built only from fixed
 * strings can say 2,500 things and cannot say the 2,501st; frames are how a
 * learner gets the 2,501st, and they only pay off if something actually asks
 * for one.
 *
 * Not scored, like the rest of the stage. The learner picks a filler, reads the
 * result aloud, and says they did it. There is no pronunciation grade and no
 * pass mark, because a beginner who is afraid to open their mouth costs more
 * than any measurement is worth.
 *
 * Pure, so the choosing and the expansion can be argued with in a test.
 */

import { expandFrame } from "@/lib/content/types";

export type FrameFiller = {
  /** Chunk id, or `lit:<text>` for a literal. Stable, so a choice can be logged. */
  key: string;
  /** What goes in the hole: "a coffee", "Mexico". */
  text: string;
};

export type SessionFrame = {
  id: string;
  pattern: string;
  esPattern: string;
  slot: string;
  fillers: FrameFiller[];
};

export type FrameOption = {
  key: string;
  /** The filler alone, for the button. */
  text: string;
  /** The whole sentence the learner says. */
  sentence: string;
};

export type FrameDrill = {
  frameId: string;
  /** The pattern with the slot shown as a blank, for display. */
  prompt: string;
  esPattern: string;
  options: FrameOption[];
};

/** How many fillers to offer at once. */
export const MAX_FRAME_OPTIONS = 5;

/**
 * Which frame this session gets.
 *
 * One per session, taken in order and wrapping, exactly like `pickSceneIndex`:
 * a unit's frames are as authored, and a learner who keeps practising a
 * finished unit should meet them again rather than hit a wall. Derived from
 * sessions completed rather than stored, so there is no second source of truth
 * about progress that can drift from the first.
 */
export function pickFrameIndex(completedSessions: number, frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.max(0, completedSessions) % frameCount;
}

/** The pattern with its slot rendered as a blank the learner can see. */
export function promptFor(pattern: string, slot: string): string {
  return pattern.replace(`{${slot}}`, "______");
}

/**
 * A frame turned into something to say.
 *
 * The fillers offered are seeded on the session rather than random, for the
 * same reason the comprehension options are: a re-render mid-question must not
 * rearrange the choices under the learner. Seeding on the session and not the
 * frame means the same frame met again next week offers a different handful,
 * which is the point of authoring a dozen fillers for it.
 */
export function buildFrameDrill(frame: SessionFrame, seed: string): FrameDrill | null {
  const usable = frame.fillers.filter((f) => f.text.trim().length > 0);
  if (usable.length === 0) return null;

  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }

  const start = (h >>> 0) % usable.length;
  const options: FrameOption[] = [];
  for (let i = 0; i < usable.length && options.length < MAX_FRAME_OPTIONS; i++) {
    const filler = usable[(start + i) % usable.length];
    options.push({
      key: filler.key,
      text: filler.text,
      sentence: expandFrame(frame.pattern, frame.slot, filler.text),
    });
  }

  return {
    frameId: frame.id,
    prompt: promptFor(frame.pattern, frame.slot),
    esPattern: promptFor(frame.esPattern, frame.slot),
    options,
  };
}
