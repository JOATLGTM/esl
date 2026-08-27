#!/usr/bin/env -S npx tsx
/**
 * Ear-training recording kit (PRD F3, 8.1B).
 *
 *   npm run content:recording-kit -- --contrast=ee_ih
 *   npm run content:recording-kit -- --contrast=ee_ih --speaker=hs_03
 *
 * Minimal-pair audio is read by real people, never synthesised: high-variability
 * training works BECAUSE the talkers genuinely vary, and neural voices are far
 * narrower acoustically than humans are. So the pipeline's job here is not to
 * generate anything -- it is to make reading the list as easy as possible for a
 * volunteer who is doing you a favour on a Saturday.
 *
 * Writes content/recordings/<contrast>/<speaker>/SCRIPT.md: the words to read,
 * in a fixed order, with the instructions and the consent line.
 */
import fs from "node:fs";
import path from "node:path";
import { loadContent, loadSpeakerRoster } from "../lib/content/load";
import { CONTRAST_LABELS, type Contrast } from "../lib/content/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

function script(contrast: Contrast, speakerId: string, words: string[], accent: string): string {
  const label = CONTRAST_LABELS[contrast];
  const numbered = words.map((w, i) => `${String(i + 1).padStart(3, " ")}.  **${w}**`).join("\n");
  return `# Recording script — ${label.en} (${label.example})

**Speaker:** \`${speakerId}\` · ${accent}
**Words:** ${words.length} · **Time:** about 15 minutes · **Kit:** your phone, a quiet room

Thank you for doing this. These recordings are how people learning English train
their ear to hear the difference between \`${label.example.replace(" / ", "\` and \`")}\`.
It only works if lots of different people read the same words, so your voice is
the point — please read normally, in your own accent. Do not perform, do not
slow down, and do not try to sound like anyone else.

## How to record

1. Somewhere quiet. No music, no fan, no traffic. A soft room beats a big one.
2. Hold the phone about a hand's width from your mouth, slightly off to the side
   so you are not breathing straight into it.
3. Record **one continuous take** of the whole list.
4. Say each word **once**, clearly, then pause for about a second before the next.
   The pause matters — it is how the file gets split up afterwards.
5. If you fluff a word, just pause, say it again, and keep going. We will trim it.
6. Read the number too if it helps you keep your place; the numbers get cut.

## What happens to it

The take is split into one short file per word and used inside the app as
listening practice. Nothing else. Your name is not attached to it and no clip is
longer than the single word you said.

**Before recording, someone needs your consent on file.** Reply to whoever asked
you with: *"I agree that my recordings can be used in this app."* Until then the
build refuses to ship your clips, which is the intended behaviour.

## The words

${numbered}

---

## For whoever ingests this (not the speaker)

1. Split the take one word per file. In Audacity: **Analyze > Label Sounds**
   (Threshold −30 dB, minimum silence 0.4 s), check the labels line up, then
   **File > Export > Export Multiple**, split on labels.
2. Name each file after the word, lowercase: \`sheep.wav\`, \`ship.wav\`.
3. Put them in \`content/recordings/${contrast}/${speakerId}/\`.
4. Set \`status: recorded\` and \`consent: on_file\` for \`${speakerId}\` in
   \`content/speakers.yaml\`.
5. \`npm run content:audio\` — the clips are transcoded and registered. Then
   \`npm run content:validate\` will stop nagging about this speaker.
`;
}

function main() {
  const bundle = loadContent();
  const roster = loadSpeakerRoster();
  const contrastArg = opt("contrast");
  const speakerArg = opt("speaker");

  if (!contrastArg) {
    console.log("\n  usage: npm run content:recording-kit -- --contrast=<id> [--speaker=<id>]\n");
    console.log("  contrast sets that exist:");
    for (const [id, set] of bundle.contrasts) {
      console.log(`    ${id.padEnd(18)} ${set.pairs.length} pairs, speakers: ${set.speakers.join(", ")}`);
    }
    console.log("");
    process.exit(1);
  }

  const set = bundle.contrasts.get(contrastArg as Contrast);
  if (!set) throw new Error(`no contrast set "${contrastArg}" — expected content/contrasts/${contrastArg}.yaml`);

  const speakerIds = speakerArg ? [speakerArg] : set.speakers;
  const byId = new Map(roster.speakers.map((sp) => [sp.id, sp]));

  // Both sides of every pair, interleaved as authored. The speaker reads them
  // adjacent on purpose: it is easier to keep the vowel honest when the
  // contrast is right there than when the words are shuffled.
  const words = set.pairs.flatMap((p) => [p.word_a, p.word_b]);

  console.log(`\n  Recording kit — ${set.contrast}, ${words.length} words\n`);
  for (const speakerId of speakerIds) {
    const speaker = byId.get(speakerId);
    if (!speaker) throw new Error(`speaker "${speakerId}" is not in content/speakers.yaml`);
    const dir = path.join(process.cwd(), "content", "recordings", set.contrast, speakerId);
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "SCRIPT.md");
    fs.writeFileSync(file, script(set.contrast, speakerId, words, speaker.accent));

    const have = words.filter((w) =>
      fs.existsSync(path.join(dir, `${w.toLowerCase()}.wav`))
    ).length;
    console.log(
      `    ${speakerId}  ${speaker.accent.padEnd(24)} ${have}/${words.length} recorded` +
        `  →  ${path.relative(process.cwd(), file)}`
    );
  }
  console.log("");
}

main();
