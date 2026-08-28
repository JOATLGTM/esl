# Content pipeline (PRD F9)

Content is files in this repo, not rows in an admin UI. A unit is a YAML file, a
schema validates it, and a script turns it into audio. If you cannot express
something here, the schema is wrong — change the schema, don't work around it.

```
content/
  curriculum.yaml            the A0→A2 spine; lists only units that exist
  vocab-schedule.yaml        which words become legal in which unit -- read
                             this BEFORE authoring, not after
  characters.yaml            the recurring cast, one fixed voice each
  units/<unit_id>.yaml       chunks + scenes + speaking task
  contrasts/<contrast>.yaml  HVPT minimal-pair drill sets
  voices.yaml                the TTS roster, for scripted content only
  speakers.yaml              the HUMAN roster, for ear training only
  pronunciation-overrides.yaml   what the engine says, never what a word is
  recordings/<contrast>/<speaker>/  human minimal-pair takes (source assets)
  wordlists/cognates.yaml    cognates, suffix rules, false friends
  wordlists/proper-nouns.yaml names and places that cost a reader nothing
  audio-manifest.json        generated; maps content hash → URL + timings
```

## Commands

```bash
npm run content:validate                    # schema + the 95% rule + PRD rules
npm run content:publish-check               # same, with warnings promoted to errors
npm run content:audio -- --dry-run          # what it would do
npm run content:audio -- --provider=silent  # offline placeholders, no engine needed
npm run content:audio                       # real voices
npm run content:recording-kit -- --contrast=ee_ih   # scripts for volunteers
npm run content:spike                       # the week-1 engine A/B (PRD 10)
npm test                                    # the pipeline's own tests
```

Nothing here costs money at any point. Every engine is local, audio is generated
once on a developer machine and committed, and the running product plays a static
file: no API, no key, no per-user cost, and the whole core loop works offline.
`tests/no-paid-apis.test.ts` fails the build if that ever stops being true
(PRD 8.1E).

`--provider=silent` generates correctly-encoded silence at plausible durations.
It exists so the whole app can run on a laptop with no TTS engine at all while
you build the session player.

## Two kinds of audio, and they are not interchangeable

This is the distinction the pipeline is built around, and conflating them is the
main way the product quietly gets worse (PRD 8.1).

|  | Scripted content | Ear training |
|---|---|---|
| What | chunks, examples, scene lines | minimal-pair words |
| Source | TTS, generated locally | **real humans, recorded** |
| Roster | `voices.yaml` | `speakers.yaml` |
| Why | consistency and volume | acoustic variability IS the mechanism |

High-variability phonetic training works *because* the talkers genuinely vary —
the learner cannot memorise one voice, so they build a category, and the category
generalises to voices they have never heard. Neural TTS voices are far narrower
acoustically than real people, so a synthesised minimal-pair set produces a drill
that looks right in the UI and teaches much less than it appears to. The voice
roster schema refuses an `hvpt` role, the plan has no code path that could
synthesise one, and a test asserts both.

Recording six people reading fifty words each is a weekend and costs nothing.
`npm run content:recording-kit` writes them each a script. If volunteers never
materialise, the fallback is mining VCTK or LibriTTS with the Montreal Forced
Aligner — not switching to TTS.

## One voice per character, forever

`characters.yaml` is the only place a scene voice is decided. Six recurring
characters run through all six blocks (PRD 4.3), and a learner who recognises Ana
before she says her name is getting immersion for free. That only survives if her
voice never drifts, so the audio plan looks the voice up by character id and has
no positional or rotating assignment to drift with.

Scene transcripts address the cast by id:

```yaml
transcript: |
  ANA: Good morning, Miguel.
  MIGUEL: Good morning.
```

A speaker tag that is not a character id fails validation. That is deliberate: it
is how anonymous `A:` / `B:` walk-ons stay out of the story.

## The voice-distinctness probe

Before generating anything, the pipeline synthesises one probe line in every
voice, decodes it, and hashes the waveform. Two voices that produce identical
audio abort the run.

This exists because Block 1 shipped without it. macOS `say` silently falls back
to the system default when a named voice is not downloaded — no error, no
warning, plausible output — so `us_f_1`, `us_m_1` and `uk_f_1` were three names
for Samantha. Every "conversation" was one talker playing all the parts, and the
HVPT drill's no-two-consecutive-speakers rule was satisfied on paper and violated
in the ear. Nothing in code review would have caught it; one second of listening
would have. So now the pipeline listens.

Compare decoded PCM, not files: Ogg randomises its stream serial per file, so
byte-different files routinely hold identical audio.

## Authoring a unit

1. Copy `units/b1_u1.yaml`. Give it a new `unit_id` and globally-unique chunk
   and scene ids.
2. Add the id to the right block's `units:` list in `curriculum.yaml`.
3. Write chunks first, scenes second. Scenes can only use words the chunks
   already taught — that is the constraint, and writing scenes first means
   rewriting them.
4. Cast every scene line to a character who already exists.
5. Run `npm run content:validate` until it is clean.
6. Run `npm run content:audio`, then **listen to Block 1 in full** before it
   reaches anyone. Bad audio in a listening product is worse than no audio.

## The rules the validator enforces

Hard failures (from the PRD):

| Rule | Where |
|---|---|
| Every scene is ≥95% known words for a learner at that point | PRD F4 |
| Every chunk has a Spanish gloss, an example, and audio | PRD F9 |
| A unit introduces at most 45 new chunks | PRD F9 |
| `target_contrast` is one of the nine in PRD 4.4, and its drill set exists | PRD F9 |
| Every scene speaker is a cast member, and no two share a voice | PRD 4.3 |
| An HVPT set has ≥20 pairs and ≥4 speakers, varied in gender and accent, ≥1 non-native | PRD F3/4.4 |
| A corpus-sourced speaker carries its licence attribution | PRD 8.1B |
| Every scene has exactly 3 comprehension questions, with in-range answers | PRD 4.2 |
| A `scripted` speaking task has a script, and the learner has a line in it | PRD 4.5 |

Publish gates — warnings while you author, errors under `--publish`: chunks with
fewer than two generated voices, contrast sets without four speakers who have
read the whole list, and any volunteer whose consent is not on file.

## How the 95% rule is computed

```
readability_score = (known_tokens + cognate_tokens) / total_tokens   ≥ 0.95
```

- **known** — every word taught by a chunk or its example in this unit or any
  earlier unit in curriculum order. Scenes are scored against the set *including*
  this unit's own chunks, because the daily loop introduces them in Stage 2
  (Meet) before the scene plays in Stage 3 (Absorb).
- **cognate** — transparent Spanish–English cognates, from the curated list or
  the suffix rules. Credit is withdrawn at A2+ per the taper: cognates are a
  scaffold with an expiry date, like Spanish itself.
- **false friends never count.** `embarrassed`, `library`, `actually` and 47
  others are on a denylist that beats every other rule, because a learner who
  "recognizes" one of them has understood the sentence backwards.
- **proper nouns are always free** and never become cards.

Example sentences get slightly more slack than scenes (two new words), because
they are short enough that 95% leaves literally no room, and because every word
in an example is on the card itself, glossed, with audio.

## Audio

Everything is Opus 32 kbps mono (PRD §8 mobile-data budget), generated once at
build time, cached by content hash. Editing one chunk regenerates one clip. Human
recordings are transcoded to the same budget and keyed by speaker and word, so
they survive a TTS engine change — they were never tied to one.

Scenes are synthesized line by line and stitched with a 420 ms gap, which is how
the manifest gets the sentence-level timings that the transcript's tap-to-seek
needs (PRD F4).

`pronunciation-overrides.yaml` fixes what the engine *says* — espeak-ng guesses
at names, and a learner who hears "Miguel" mangled learns the mangled version.
The learner always reads the real spelling; the override never leaves the
synthesiser. It participates in the clip hash, so editing one line regenerates
exactly the clips containing that word.

**Deviation from the PRD, on purpose:** the PRD says the pipeline writes URLs
back into the YAML. It writes them to `audio-manifest.json` instead — rewriting
25 chunks × 4 voices inline would bury the authored content and fight every
comment in the file. The manifest is what the app resolves against.

## Open content questions

- **The engine choice is not settled.** `provider: macos` is what the committed
  audio was generated with; the PRD prescribes Piper (8.1A) and makes the
  decision a week-1 listening test. Run `npm run content:spike`, listen, and
  decide before Block 2 is authored. Piper needs `pip install piper-tts` and one
  `python -m piper.download_voices` per voice.
- **No ear-training audio exists yet.** Six speakers × fifty words for `ee_ih`.
  Until they are recorded, Stage 1 of the daily loop has nothing to play, and
  `--publish` will keep failing. This is the largest single content lift in the
  project (~1,440 clips across nine contrasts) and it is a weekend of favours,
  not an engineering problem.
- **`b1_u1` is 25 chunks, not the 6–8-per-session × 6 sessions the PRD's daily
  loop implies (36–48).** Block 1's cumulative target of 150 across 6 units
  works out to ~25/unit, so the block table and the session table disagree. The
  block table wins here: at absolute zero, four new chunks a session is already
  enough. Later blocks should hit 6–8.
- **6 scenes per unit, not 15.** One per session. The PRD's 15/unit figure and
  its own MVP figure (60 scenes across Blocks 1–2, i.e. 5/unit) disagree; one
  scene per session is the number that matches the daily loop.
- The Oxford 3000 CEFR tagging is not wired in — `cefr` on each chunk is
  hand-set. Drop the tagged list in and the validator can cross-check it.
