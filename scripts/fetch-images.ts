#!/usr/bin/env -S npx tsx
/**
 * Pull the pictograms the content references from Noto Emoji
 * (`docs/ROADMAP.md` #6). Run: `npm run content:images`
 *
 * One set, one style, one licence: Noto Emoji's artwork is Apache 2.0 --
 * attribution, no copyleft, no non-commercial clause -- which is the cleanest
 * licence of any pictogram source considered (Mulberry and OpenMoji are
 * CC BY-SA, ARASAAC is CC BY-NC-SA). Colour emoji are recognisable at 40 px,
 * culturally neutral for the things this course pictures (a coffee, a bus, a
 * clock face), and complete enough that every concrete noun in Block 1 has one.
 *
 * The map below is the whole editorial decision: what gets a picture. Only
 * concrete referents are in it. "I don't understand" has no entry and never
 * will -- see `public/images/README.md`.
 *
 * Idempotent: a file already on disk is not fetched again. Writes
 * `public/images/LICENSE.md` with the attribution every time.
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "images");
const REPO = "https://raw.githubusercontent.com/googlefonts/noto-emoji/main";
const urlFor = (code: string) =>
  code.startsWith("flag:") ? `${REPO}/third_party/region-flags/svg/${code.slice(5)}.svg` : `${REPO}/svg/emoji_u${code}.svg`;

/** name -> Unicode codepoint(s), lower-case hex, joined by `_` as Noto names them. */
export const PICTOGRAMS: Record<string, string> = {
  // the café
  coffee: "2615",
  tea: "1f375",
  water: "1f4a7",
  milk: "1f95b",
  bread: "1f35e",
  sandwich: "1f96a",
  salad: "1f957",
  fruit: "1f34e",
  soup: "1f372",
  chocolate: "1f36b",
  food: "1f37d",
  // places
  store: "1f3ea",
  park: "1f333",
  bank: "1f3e6",
  market: "1f6d2",
  hospital: "1f3e5",
  restaurant: "1f37d",
  building: "1f3e2",
  house: "1f3e0",
  bus: "1f68c",
  // people (generic figures, never a specific face)
  mother: "1f469",
  father: "1f468",
  sister: "1f467",
  brother: "1f466",
  son: "1f466",
  daughter: "1f467",
  wife: "1f469",
  husband: "1f468",
  family: "1f46a",
  friends: "1f465",
  friend: "1f9d1",
  home: "1f3e0",
  // things
  phone: "1f4f1",
  photo: "1f5bc",
  calendar: "1f4c5",
  // clock faces, for `I start at {TIME}` and the time chunks
  "clock-5": "1f554",
  "clock-6": "1f555",
  "clock-7": "1f556",
  "clock-8": "1f557",
  "clock-9": "1f558",
  "clock-10": "1f559",
  "clock-11": "1f55a",
  "clock-12": "1f55b",
  "clock-1": "1f550",
  "clock-4": "1f553",
  // flags, for `I'm from {PLACE}` -- Noto keeps these apart from the emoji
  // set, as region-flags/svg/<ISO>.svg, and notes they are public domain.
  "flag-mexico": "flag:MX",
  "flag-guatemala": "flag:GT",
  "flag-honduras": "flag:HN",
  "flag-colombia": "flag:CO",
  "flag-peru": "flag:PE",
  "flag-ecuador": "flag:EC",
  "flag-venezuela": "flag:VE",
  "flag-bolivia": "flag:BO",
};

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let fetched = 0;
  let kept = 0;
  const failed: string[] = [];

  for (const [name, code] of Object.entries(PICTOGRAMS)) {
    const file = path.join(OUT, `${name}.svg`);
    if (fs.existsSync(file)) {
      kept++;
      continue;
    }
    const res = await fetch(urlFor(code));
    if (!res.ok) {
      failed.push(`${name} (${code}): HTTP ${res.status}`);
      continue;
    }
    fs.writeFileSync(file, await res.text());
    fetched++;
  }

  fs.writeFileSync(
    path.join(OUT, "LICENSE.md"),
    `# Image attribution

The pictograms in this directory (every \`*.svg\` except the cast portraits
\`portrait-*.svg\`) are from **Noto Emoji** by Google,
<https://github.com/googlefonts/noto-emoji>, used under the
**Apache License, Version 2.0** <https://www.apache.org/licenses/LICENSE-2.0>.
Flags are from the same repository's \`third_party/region-flags\`, which it
notes are public domain. All are unmodified. Fetched by \`scripts/fetch-images.ts\`, which records which
emoji each file is.

The cast portraits (\`portrait-*.svg\`) are original to this project.
`,
  );

  console.log(`\n  Images: ${fetched} fetched, ${kept} already present, ${failed.length} failed`);
  for (const f of failed) console.log(`    ✗ ${f}`);
  if (failed.length) process.exit(1);
}

main();
