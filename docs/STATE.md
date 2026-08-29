# Where the project is

**Last updated:** 2026-08-29 · **Read this before touching anything.**

Hablar — self-paced English for Spanish-speaking beginners, per the PRD (v2.1).
Six build sessions done. This file exists so the next one does not have to
re-derive what was decided or rediscover what bit us.

**Where it stands in one line:** the app is finished, **Block 1 is finished**
(6 units, ~36 days of content), and the next real work is a vocabulary schedule
for Blocks 2–4, which needs frequency data this repo does not contain.

Read it alongside, not instead of:

| File | What it covers |
|---|---|
| `AGENTS.md` | this is Next 16 — read `node_modules/next/dist/docs/` before writing app code |
| `docs/DEPLOY.md` | env vars, audio hosting, auth URLs — read before any deploy |
| `docs/ROADMAP.md` | what to build next and why — ranked, with the two measured findings that drive the order |
| `docs/CONTENT-BRIEF.md` | where content comes from: the sourcing research, its licences, and what was done with it |
| `content/README.md` | the authoring pipeline, the 95% rule, the two kinds of audio |
| `content/STORY.md` | the cast, the four block arcs, the beat each unit hits — read before writing a scene |
| `content/vocab-schedule.yaml` | which words become legal in which unit — read before authoring, not after |
| `supabase/README.md` | schema, RLS, the connection layer |
| `lib/copy/es.ts` | every Spanish string, with the house style at the top |

---

## Start here

```bash
npm run dev              # needs .env.local, already present locally
npm test                 # 345 tests, ~30s (three suites hit the live database)
npm run content:validate # schema, the 95% rule, the vocabulary schedule
npm run content:publish-check   # the same, with warnings as errors
```

`public/audio/` **is** tracked — 1,287 Opus files, 16 MB. It cannot be built on
Vercel (Piper is a local binary and the voice models are ~1.1 GB, gitignored),
so the repo is the only thing that carries sound to production. Regenerating
needs the Piper setup in open item 4 below, and **must be run in the
foreground** — see the traps.

Verified: no `.env.local` in history, only `.env.example` is tracked.

---

## Live infrastructure

Supabase project **`esl`** — ref `sqjjikmwxnfeuzzxqnmk`, us-east-2, Postgres 17.6.
Linked. Eight migrations applied. Content seeded. Auth config pushed.

| Table | Rows |
|---|---|
| blocks / characters / speakers | 6 / 6 / 6 |
| units / chunks / frames | 6 / 154 / 12 |
| scenes (story + listening) / dialogues / missions | 36 + 12 / 6 / 12 |
| contrast_sets / minimal_pairs | 1 / 25 |

`.env.local` exists and works. It is gitignored; `.env.example` documents it.

**Deployed at <https://esl-psi.vercel.app>.** `site_url` and the auth redirect
allow-list point there as of 2026-08-27 (`npx supabase config push`, verified
`auth: up_to_date`); `config.toml` is the source of truth, so never edit those
values in the dashboard. `docs/DEPLOY.md` covers the rest.

---

## What is built

**Content pipeline (F9)** — complete, and it is the part with the most thought
in it. YAML → schema validation → the vocabulary schedule → local Piper TTS →
`audio-manifest.json` → Supabase. **Block 1 fully authored**: 6 units, 152
chunks, 12 frames, 36 scenes, 12 missions. **1,287 Opus files, 16 MB**, ~2.2 MB
per unit against an 8 MB per-unit budget.

The validator is the arbiter and has earned it: it has caught a word that did
not exist (`caf`, from an accent that truncated rather than separated), fillers
pointing at chunks the learner had not met, released-but-untaught words riding
the 5% budget, and a wrapped transcript line with no speaker. Every one of
those would have shipped.

**Database + RLS (Appendix A step 1)** — complete. Content is public-read with no
write policy at all; learner data is owner-only. Proved live, not asserted.

**Auth + onboarding (F1)** — complete. Routes: `/`, `/login`, `/signup`,
`/onboarding`, `/home`, `/auth/callback`.

**Session shell (§4.2)** — the walking skeleton, *not* the five stages. Route
`/session/[unitId]`. It opens or resumes a `sessions` row, drives
`stage_reached` forward one stage at a time, closes the session on the last
stage and credits the practice day. Each stage renders its title, its one-line
promise, and an honest "still being built" note — the same thing `/home` did
while this was the gap. `/home`'s "Empezar" is now live and points at
`current_unit`.

**Meet (§4.2 stage 2)** — built. One phrase per screen, English large, audio on
arrival, and the Spanish behind a tap. Six new chunks against a 20-minute goal
(`newChunkBudget`), taken in curriculum order from whatever the learner has no
card for yet. Leaving the stage writes one `user_cards` row per chunk shown,
`state = 'learning'`, with `gloss_reveals` set for the ones whose gloss was
revealed — which is the number F2 later reads to offer stepping the Spanish
taper back a level.

**Absorb (§4.2 stage 3 / F4)** — built. One scene per session, taken in story
order from how many sessions the learner has finished in the unit
(`pickSceneIndex`) — there is no table recording a scene as seen, and inventing
one would be a second source of truth about progress. The transcript is on
screen throughout, the playing line is highlighted, and tapping any line seeks
to it and plays just that line, using the sentence timings authored into
`scenes.transcript`. Then three comprehension questions, one at a time, never
scored: a wrong answer highlights the right one and moves on.

**Retrieve (§4.2 stage 4 / F2)** — built. FSRS via `ts-fsrs`, whose card shape
maps 1:1 onto `user_cards` so a card round-trips untranslated. A card's first
sight is recognition (it was met minutes ago; asking a beginner to reproduce it
cold teaches them they are bad at this), everything after is `produce_typed`.
Reviews are written **one at a time as they happen**, not batched at the end —
close the tab after eight of fifteen and you keep eight reviews.

**Speak (§4.2 stage 5 / 4.5 / F5)** — built. Scripted mode: the exact line is on
screen and success is saying it. No pronunciation score, no pass mark. Recording
is offered on the last line and never required — it goes browser-direct to
Storage, and `sessions.speaking_tasks_completed` is incremented server-side on
finishing the script, never gated on a microphone.

**Ear (§4.2 stage 1 / F3)** — built, and correctly invisible. There are still
zero human recordings, so `availableStages` skips it; it lights up on its own
when the clips land, with no code change. The drill logic is fully tested
without them.

**Unit progression** — built. A unit is finished when the learner has met every
phrase in it **and** heard the whole story (`isUnitComplete`); on the session
that closes it, `current_unit` and `current_block` advance to the next unit in
curriculum order. Checked when a session completes, which is the only moment the
answer can change.

Mastery is deliberately not part of the rule — see the decisions below.

**F8 — XP, quests, streak** — built. `/home` is now what PRD 7 asks for: one
button, the counts, three daily quests, nothing else. XP is paid on stages
finished and speaking done, never on accuracy. The three quests are generated
lazily on first sight of the day (no cron, and a skipped Tuesday leaves nothing
waiting on Wednesday), one is always speaking, and the other two are drawn from
a pool seeded on the date.

**Achievements, known words, F6 and F11** — built 2026-08-28.

- **Achievements** complete F8. Eight keys, all awarded for something the
  learner *did*; the first three are reachable in one session, because the
  moment a beginner quits is before they have any evidence this works.
  Recomputed in full on every session close rather than event-driven, so a
  learner who qualified while a bug swallowed the event still gets the row.
- **`known_words`** fills as chunks are met — the per-learner counterpart to
  the 95% rule the content pipeline enforces statically.
- **F6 error patterns.** `lib/content/error-patterns.ts` holds eight documented
  Spanish→English transfers as *data*, matching the schema's own reasoning for
  making `error_type` text rather than an enum. A pattern only fires when the
  learner's answer matches it and the expected answer does not, so it cannot
  flag a correct answer.
- **F11 shadowing** lives inside Absorb, not as a sixth stage: shadowing works
  on material just understood, and adding to `session_stage` would be a schema
  change to accommodate a UI decision. One line per scene, walked through
  listen → repeat → shadow, skippable throughout.

**F12 missions** — built 2026-08-28, content and all. Its own route
(`/mission`) rather than a stage, because it is the one thing in the product
that does not happen on the phone; inside the daily loop it would read as
another exercise to tap through. Two missions authored for `b1_u1`, offered
easiest-first and only once their preparation chunks have been met — a mission
whose phrases the learner has never seen is a request to improvise, which is the
one thing a nervous beginner will not do.

`alternate_es` is **required** by the schema, not optional. A learner with no
English speakers near them is exactly who this course is for, and the UI offers
the alternative as an equal option rather than a consolation.

**Error boundaries, an offline page and a keepalive**, added 2026-08-28 after a
review asked what "free forever" actually costs. The answer was that money is
not the risk: the free Supabase project pausing on inactivity is, and nothing
handled it.

The predicted symptom was an English stack trace. **It was measured instead, and
the truth was different and worse.** Pointed at an unreachable project, nothing
throws — `getUser()` returns null on any failure, every guard reads that as
"signed out", so `/home`, `/session` and `/mission` all 307 to
`/login?next=...`. The learner is *silently forgotten*, sent to a login that
cannot succeed, and told nothing; the landing page meanwhile says the sample
lesson "se está preparando", which is untrue. For a beginner who already
suspects he is the problem, that is worse than an error page.

Now: `app/error.tsx` and `app/global-error.tsx` (Spanish, no stack trace — the
global one carries its own `<html>`, `<body>` and inline styles, because it
replaces the root layout and **gets no `globals.css`**), plus `/pausa`, which
says the true thing: your progress is safe, this is ours not yours, try later.
`proxy.ts` tells the two causes apart by asking a public-read content table —
only on a request already being turned away, so the happy path costs nothing.

**Piper replaced macOS `say`** on 2026-08-28, and the deciding argument was not
that it sounds better. `say` accepts `-r 155` and **ignores it** — four of six
voices ran at 101–109 wpm against a declared 150–160, so the roster was fiction
and no amount of editing it would have helped. Piper has `length_scale`, so
`rate_wpm` became a thing the pipeline can enforce. It also runs on Linux, so
the curriculum is no longer buildable on exactly one laptop.

Piper has no words-per-minute setting, so `voices.yaml` now carries
`natural_wpm` per voice — the model's measured pace at `length_scale 1.0` — and
the provider derives the scale from `natural_wpm / rate_wpm`. Those constants
were calibrated empirically, twice: the first pass (from the spike) left
`uk_m_1` 17% fast, so the true values were back-computed from the rendered
manifest and it was regenerated. **Re-measure whenever a Piper model changes.**

**A speech-rate gate on the audio pipeline** (`lib/content/speech-rate.ts`),
added 2026-08-28. The pipeline already proved the voices were *distinct* — that
guard exists because Block 1 once shipped with three names for Samantha. This
is the missing half: **distinct is not the same as appropriate.**

macOS `say` accepts `-r 155` and ignores it. Measured from the committed
manifest: the six voices run 90–136 wpm against a declared 150–160, and in
`s_0001` Ana speaks 1.40× faster than Miguel — the learner's own in-story
counterpart, explicitly "igual que tú", is the one who sounds slow. Nobody had
looked, because nothing checked.

The gate warns while authoring and **fails `content:publish-check`** (17 errors
today). It is deliberately not a hard error: the audio really is wrong, and the
fix is the TTS engine decision (open item 4), which is a listening test nobody
can run in CI. Blocking authoring on a decision that needs ears would just get
the check deleted.

**Four learner-facing defects fixed 2026-08-28**, all found by an
adversarial review that re-ran the code rather than reading it. Every one was
invisible to the test suite because the tests checked that each part was
*correct*, never that the learner-facing whole was *fair*.

1. **The first question of the first session was unfair.** Recognition
   distractors were drawn from the cards due *today*, which on day one is the
   six greetings Meet had just introduced in curriculum order. "Hello" is
   glossed `Hola`; "Hi" is glossed `Hola (informal)`. Measured: they were
   offered as competing answers on **34.5%** of first "Hello" cards. Fixed by
   widening the pool to every gloss the learner has met and by refusing
   confusable options (`lib/session/distractors.ts`). Re-measured across 1,800
   simulated day-one cards: **zero**.
2. **`buildOptions` duplicated a distractor** when only two glosses were
   available — same wrong answer twice, plus a duplicate React key. It now
   shows fewer options rather than a bad one, and `canBuildRecognition` refuses
   to build a "multiple choice" with a single button.
3. **The grader marked correct English wrong.** Seven of the twenty-five
   chunks contain a contraction, and every one rejected the expanded form:
   `What is your name?` failed against `What's your name?` because expanding
   costs two edits against a typo budget of one — while scene `s_0003` has Tom
   saying *"What is your name?"* aloud. `normalise` now expands contractions
   (never a bare `'s` rule, which would turn "Ana's book" into "ana is book"),
   and chunks gained an `accepts: []` for author-declared alternatives.
4. **The comprehension questions mostly did not require English.** Two were
   duplicated verbatim across scenes, and several were answerable by counting
   speaker labels that Absorb keeps on screen throughout. All eighteen
   rewritten to need inference from meaning. Two validator rules added, both
   proved to fire by reintroducing the defects.

**F6 is now a whole feature.** `error_events` was write-only; `/patterns` reads
it. Two occurrences before anything is said (one slip is a bad morning, not a
pattern), at most three at a time (someone shown eight things to fix fixes
none), the rule named before the mistake, and the learner's own most recent
words as the evidence. `/home` links it only when there is something to show —
offering "algo que se te repite" and then showing an empty page is a small
cruelty.

**Frames (the generative layer)** — built 2026-08-28, end to end. A pattern with
one slot and licensed fillers: `I'd like {NP}, please.` Table, seeder, schema,
validator, and a second phase in Speak where the learner builds a sentence
nobody wrote for them. Everything before it is recall; this is the first
production of something new in the whole product, which is why it comes *after*
the script rather than instead of it.

`b1_u1` gained three, and they were already there in disguise: `My name is`,
`I'm from` and `This is` are not sentences — each has a hole, and the hole was
implicit because nothing could express it. The chunks stay (they carry the
audio and the introducing card); the frames say what follows.

**The vocabulary release schedule** (`content/vocab-schedule.yaml`) — built
2026-08-28. Names which English words become legal in which unit, and the
validator refuses a unit that teaches a word the schedule has not released.

This is the file that turns the 95% rule from something an author *discovers*
into something they *design against*. Before it, authoring meant writing a
scene, running the validator, and fighting what came back — the constraint
arrived after the work. Unit 1's 41 word types were *measured* from the
authored unit rather than invented, so it defines the baseline the rest is
planned against; units 2–6 are listed with notes and empty release lists,
because filling them is a curriculum decision that wants the sourcing research
in `docs/CONTENT-BRIEF.md`. An unfounded word list that looked finished would
be worse than an empty one.

Stepping outside the schedule is an **error**, not a warning, and deliberately:
adding a word is one line, and having to write that line on purpose is the
whole mechanism. As a warning the file would be decoration.

**The story bible and the Block 1 vocabulary plan** — written 2026-08-28, and
between them the last two authoring foundations.

`content/STORY.md` gives the four blocks an arc with stakes: **to be seen** (A0)
→ **to belong** (A1) → **to manage alone** (A1+) → **to have a voice** (A2).
Miguel arrives unable to say anything and ends the course explaining a problem
to his supervisor and being believed. Block 3 carries the real setback — he
goes out without Carlos translating, it goes wrong, and *he* fixes it. Rules
that matter: no seventh character ever (a seventh permanent voice dilutes the
recognition the cast exists for), nobody explains English inside a scene, and
immigration/police/employers/clinics may appear but Miguel is never in legal
jeopardy — the tension is always linguistic, never existential.

`content/vocab-schedule.yaml` now plans all six Block 1 units: **176 word types,
zero duplicates**, 41 → 176 across the block. Blocks 2–4 are deliberately still
empty, because they want frequency work this repo does not have.

**Two readability-inflation bugs found while doing it** — see the traps.

**BLOCK 1 IS COMPLETE** — 2026-08-29. Six units, **152 chunks, 12 frames, 36
scenes, 12 missions, 202 known word types, 13 MB of audio**, every scene at
100% readability with zero unknown tokens. About 36 days of content, which is
the Phase 1 exit criterion for content volume.

**`b1_u6` — what I want** — the last of them, and the unit the `frame` type was
built for. `I would like {NP}, please.` takes anything on a counter, and almost
everything on a counter is a Latinate cognate the scorer credits for free —
coffee, chocolate, soup, salad, sandwich, fruit. One authored pattern plus a
free filler class is a dozen sayable sentences nobody had to write.

Miguel orders at Maria's counter alone. Carlos offers to come and is turned
down; Maria *waits* when he hesitates instead of rescuing him; and by the last
scene he is asking her what **she** wants. The block ends there on purpose.

`I am hungry` is here to pre-empt an error, not to name a feeling. Spanish uses
*tener* for states English expresses with *be*, so `tengo hambre` becomes
*"I have hunger" — one L1 rule producing a family of mistakes. **A new error
pattern, `have_state_for_be`, catches it**, and is careful: `hunger`, `thirst`
and `sleep` match as bare nouns, but `cold` and `hot` only at the end of a
sentence, because "I have cold water" is perfectly good English.

**`b1_u5` — time and the schedule** — authored 2026-08-29. 25 chunks, 6
scenes, 2 frames, 2 missions, 2.1 MB. Rosa gives Miguel his hours; he reads
them back and gets the Saturday start wrong; she corrects it. This is where
Block 1 stops being about meeting people and becomes about the thing he came
here to do.

**Rosa is doing more work than the vocabulary is.** She is the authority
figure, and a nervous beginner expects authority to be a threat. When Miguel
gets his hours wrong she corrects the *fact* and not his English, does not
apologise for him, and does not slow down theatrically. That is the whole
reason she exists in the cast.

`yesterday` was planned for this unit and **cut**: there is no grammatical way
to use it without a past tense, and the past tense is Block 4. A word you
cannot put in a sentence is not released, it is listed. `or` and `now` were
added in its place, both earning it immediately.

First unit to pass the audio gates on the first generation — no short scenes,
no rate spread — because the ~85-token heuristic below was applied while
writing rather than discovered afterwards.

Five units, **127 chunks, 10 frames, 30 scenes**, all at 100% readability.
About 30 days of content. **One unit left in Block 1.**

**`b1_u4` — on the street** — authored 2026-08-29. 25 chunks, 6 scenes, 2
frames, 2 missions, 2.3 MB. Miguel gets lost on the way to the café, is
pointed, arrives — and in the last scene gives directions to **Carlos**, the
man who has spent three units offering to translate for him. That inversion is
the unit.

`I am lost` is the phrase it exists to hand someone: a repair strategy dressed
as a location, because a learner who can say it converts being stranded into a
conversation. Miguel also asks for a repeat twice and then says the directions
back — repeating instructions to confirm them is a real strategy nobody
teaches, and it is the only way an A0 learner survives directions at all.

Notably the place nouns (café, park, bank, market, hospital, restaurant) are
**not in the schedule**: they are Latinate cognates the scorer already credits.
This is the one Block 1 unit where the cognate windfall pays, which is why a
unit about places can spend its whole vocabulary budget on prepositions and
verbs of motion.

Four units, **102 chunks, 8 frames, 24 scenes, and every scene at 100%
readability with zero unknown tokens.** About 24 days of content.

**`b1_u3` — family and people** — authored 2026-08-28. 27 chunks, 6 scenes, 2
frames, 2 missions, 2.1 MB. The beat is `I miss them`: units 1 and 2 were
transactions — a greeting returned, a form survived — and this is the first
time Miguel tells someone something that costs him to say. Everything else in
the unit is scaffolding to make that sentence sayable, and `f_0005`
(`I miss my {NP}`) exists so it generalises instead of being one memorised
string.

The third-person pronouns land here, and that is structural: nothing before
this unit could talk *about* a person, only *to* one, which is why every
earlier scene is two people facing each other. Carlos also gets his
counterweight — he has been the shortcut Miguel keeps refusing, and in `s_0016`
his own family is here and he is not going back. He is not an obstacle, he is
ten years ahead.

Three units, **77 chunks, 6 frames, 18 scenes, 115 known word types**. About
eighteen days of content.

**`b1_u2` — the second unit** — authored 2026-08-28, the first written against
the foundations rather than from scratch. Numbers, age, and the yes/no answer;
25 chunks, 6 scenes, 1 frame, 2 missions, 2.2 MB of audio. Miguel needs a
phone, which means a form, which means saying his age and a string of digits to
a stranger — and Carlos turns up offering to translate and is turned down. That
refusal is the unit.

Two shapes worth copying. **Four counting chunks carry one to twenty**, because
twenty single-word chunks would be vocabulary rather than chunks, and no
example may introduce more than two new words — that cap is what forced the
shape, not taste. And **`in English` is a chunk**, which teaches `in` and is
the phrase the whole unit turns on: a learner who can ask for English chooses
which language a conversation happens in.

The course now runs about twelve days instead of six.

**The Spanish taper (PRD 4.6) is a behaviour now, not a column** — built
2026-08-29, and this is the item the previous session listed as
designed-but-unbuilt. `users.l1_support_level` had been written on every unit
advance since the first migration and **read by nothing**; the comment in
`progress.ts` even claimed the app read it, which was false and is now
corrected.

`lib/session/l1.ts` says what each level shows. Meet withdraws the gloss offer
at the least-supported level; Absorb prefers English questions above level 3,
falling back to whatever the scene actually authored — so it changes nothing
today and will change on its own when a unit ships `q_en`. **Both halves of a
question always come from one language**: a Spanish prompt over English options
is worse than either.

The important part is that **the level belongs to the learner, not the
curriculum**. `l1SupportForBlock` proposes on advance; it does not impose.
`/ajustes` is where they choose — three options, not five, because asking a
beginner to pick between "level 3" and "level 4" is asking them to model a
system they have never seen. It also carries the daily goal, which had been
chosen once at onboarding and then fixed forever.

`shouldOfferMoreSupport` finally has a caller (`lib/session/l1-server.ts`).
A learner revealing the gloss on most of their cards is offered a step back
toward more Spanish — offered, never applied, never framed as a problem, and
never shown at full support where there is nothing to offer.

**Image slots, without images** — built 2026-08-29, `docs/ROADMAP.md` #6.
`chunks[].image`, `frames[].filler_images` (keyed by literal filler text) and
`characters[].portrait`, each an optional public path; the validator fails on
a path that is not in `public/`, and on a filler image whose filler does not
exist. Seeded to `chunks.image_url`, `frames.filler_images`,
`characters.portrait_url`. Meet shows the chunk's picture beside the English —
which is the taper's missing terminus, the one thing it can withdraw the gloss
*to* — the frame chooser shows a thumbnail per filler, and both players show a
portrait beside the speaker's name.

**Nothing is pictured yet, on purpose.** Sourcing pictograms is curation with a
licence decision attached (ARASAAC is CC BY-NC-SA; Mulberry and OpenMoji are
BY-SA), and it is not a thing to do from inside a build session. The slots
exist so assets can land without a schema change or a migration; the rules
are in `public/images/README.md`.

**The cast speaks at deliberately different rates, and the learner can change
the speed** — built 2026-08-29, `docs/ROADMAP.md` #5. The gate used to hold the
whole cast within 1.10× of each other, which is tidier than real people and
worse practice. Now Ana is slowest (140, patient), Miguel slow (145, the
learner's counterpart), Rosa 150, Tom 155, Carlos 165, Maria 180 — *"where the
learner meets real speed"*, as `STORY.md` wrote her. Measured: every voice
within 5% of declared, cast spread 1.24×. Both players — Absorb and the
library — carry a 0.8× / 1× / 1.25× control (`components/ui/speed-control.tsx`),
`playbackRate` with pitch preserved.

**This cost three full regenerations of ~1,400 clips, and each one taught
something now in the traps:** the clip hash ignored the rate, so the first
roster edit produced a green "0 to generate" and the old audio; the
calibration correction was applied backwards once (`length_scale = natural /
rate` — *lowering* `natural_wpm` makes a voice faster); and a run killed at
clip 612 of 644 lost all 612 because the manifest was only written at the end.
The pipeline now adopts on-disk clips and checkpoints every 50.

**The listening library** — built 2026-08-29, `docs/ROADMAP.md` #4. A new
content type, `content/listening/<unit>.yaml`: connected speech in the cast's
voices made **entirely of words the unit has already released**. It is gated
at 100% known, not 95% — a track introduces nothing, which is the whole point:
input that costs no vocabulary. Twelve tracks exist across Block 1, **11.3
minutes, all at 100%**, taking connected speech from 22 to 33 minutes and the
per-day figure from 37 s to 56 s.

**That is the mechanism proven, not the target met.** The roadmap asks for
10–20 minutes *per unit* (3–4 hours for Block 1); two tracks a unit is a
foundation. Authoring more is now cheap — a track is ~150 tokens, passes the
validator on the first try if it stays inside the word list, and costs
nothing in vocabulary — so the remaining gap is hours, not design.

Tracks ride in the `scenes` table with **`kind = 'listening'`** rather than
a table of their own: the audio pipeline, the transcript timings and the
player are all scene-shaped already. What they must *not* share is the daily
loop — `pickSceneIndex` deals scenes by count and `isUnitComplete` finishes a
unit on scenes heard — so every reader that counts or picks scenes filters on
`kind = 'story'`. Proved live: `b1_u1` has 8 scene rows and the loop sees 6.

The library is `/escuchar`, off `/home`: every track from units at or before
the learner's current one, grouped by unit, with a player like Absorb's plus a
**0.8× / 1× / 1.25× speed control** (`playbackRate`, pitch preserved). No
questions, no score, nothing written. A shelf, not a stage.

**Writing the tracks exposed a real content gap.** Every chunk in six units is
first or second person, because conversation is — and narration is third
person. Nothing anywhere taught `has` or `does`. Two chunks fixed it
(`c_0153`, `c_0154`), which is the honest answer; the alternative was teaching
the tokenizer that `has` is a form of `have`, which would have hidden the gap
from every future scene as well.

**He can hear himself now** — built 2026-08-29, `docs/ROADMAP.md` #3. Until
this, `MediaRecorder` captured a take and uploaded it straight to Storage, and
nothing anywhere played it back — there was no `createObjectURL` in the app.
The one pronunciation intervention that works without a teacher was being
captured and thrown away. Now a take goes to a review screen first: the line
he said, a play button, *"Así sonaste. Nadie más lo oye."*, and two choices —
keep it (which is what uploads it) or record again. Re-recording replaces the
take and is never framed as correcting a mistake. Object URLs are revoked
when the take is replaced or the stage unmounts. `SpeakerIcon` moved to
`components/ui/` because two stages now need it.

**The formulation warm-up in Speak** — built 2026-08-29, `docs/ROADMAP.md` #1.
Spanish on screen, a five-second clock, and the learner says the English
*before* it appears; then the model clip plays and he compares. This is the
first thing in the product that asks for **formulation** — the message-to-form
step — which typed retrieval bypasses (no articulation) and scripted read-aloud
bypasses (the English is already on screen). Five met phrases per session,
seeded on the session, drawn from `user_cards` so nothing is ever asked that
was never shown.

**The clock is pressure, never a grade.** It runs out, the answer appears,
and nothing is written anywhere — `tests/spoken-production.test.ts` still
holds, so a self-report here cannot mature a card any more than it could in
the script. Skippable at every screen, because a warm-up someone is made to do
is a test. `lib/session/formulate.ts` is pure and tested; the loader is in
`speak.ts`.

**All five stages, progression, F8, F6, F11 and F12 are done.** The daily loop is
complete, it no longer dead-ends, and it has a reason to come back tomorrow.

A one-off welcome modal lived in the root layout for a day and was removed on
2026-08-28, having served its purpose. One thing it taught is worth keeping:
**anything meant for a signed-in learner cannot be mounted on `/`**, because
`app/page.tsx` redirects a session-holder to `/home` before that page renders.
The root layout is the only place that reaches every entry state. Some browsers
still hold a stale `hablar:welcome-seen` key in `localStorage`; nothing reads it.

**Tests — 354, all passing.**

| Suite | n | Needs network |
|---|---|---|
| `content.test.ts` | 32 | no |
| `session-stages.test.ts` | 26 | no |
| `audio-plan.test.ts` | 24 | no |
| `session.test.ts` | 21 | **yes** |
| `error-patterns.test.ts` | 19 | no |
| `frames.test.ts` | 18 | no |
| `speech-rate.test.ts` | 17 | no |
| `progress.test.ts` | 17 | no |
| `grade.test.ts` | 30 | no |
| `distractors.test.ts` | 13 | no |
| `frame-drill.test.ts` | 13 | no |
| `drill.test.ts` | 12 | no |
| `quests.test.ts` | 12 | no |
| `resilience.test.ts` | 11 | no |
| `l1.test.ts` | 11 | no |
| `vocab-schedule.test.ts` | 10 | no |
| `quiz.test.ts` | 9 | no |
| `patterns.test.ts` | 9 | no |
| `rls.test.ts` | 9 | **yes** |
| `shadowing.test.ts` | 8 | no |
| `achievements.test.ts` | 7 | no |
| `onboarding.test.ts` | 6 | **yes** |
| `transcript.test.ts` | 5 | no |
| `no-paid-apis.test.ts` | 4 | no |
| `spoken-production.test.ts` | 2 | no |

The last three create and delete real users. They run whenever `.env.local` has
`RLS_TEST_ENABLED=1`, which is why `npm test` takes ~6s instead of 0.2s. **Never
point them at production.**

---

## Decisions that depart from the PRD

Each of these looks like a bug if you only read the PRD. They are not. If one
turns out to be wrong, change it deliberately — do not "fix" it back.

**The course ends at A2, in 24 units — not B1 in 36** (§4.3). Changed
2026-08-28 after the content brief came back; the reasoning is in
`docs/CONTENT-BRIEF.md` and the short version is arithmetic. 36 units is
~120–150 learner-hours; A0→B1 is conventionally 350–400. No sourcing strategy
closes a 200-hour gap, so the old spine promised an endpoint it could not
reach. The cognate discount does not rescue it either — Blocks 1–3 live in
Germanic core vocabulary, and the Latinate windfall arrives at B1+, which is
exactly where this course would have stopped.

A2 is not a consolation prize for this learner: understanding a supervisor,
handling a transaction, making a phone call, talking to a neighbour. That is
the delta that changes a life, and shipping it honestly beats shipping half a
B1 promise. Blocks 5–6 are deferred, not cancelled — `CEFR_LEVELS` still
carries `A2+` and `B1`, and `CurriculumSchema` still allows six blocks, so
they drop back in without a migration.

**Chunks are not the only content type any more: there are frames** (added
2026-08-28). A frame is a pattern with one slot and a list of licensed fillers
— `I'd like {NP}, please.` The reason is that a course built only from fixed
strings tops out as an excellent phrasebook: it can say 2,500 things and cannot
say the 2,501st. The formulaic-sequence research this pedagogy rests on treats
chunks as raw material the learner *unpacks* into patterns, and until this type
existed nothing in the content model could represent that unpacking.

It is also the only item whose authoring cost does not scale with what it
teaches: one pattern and a dozen fillers is a dozen sentences. That ratio is
why 24 units can reach a real A2 on ~850 chunks where the old spine implied
~1,600.

Two things about the schema that look like oversights and are not. **Both
patterns use the same slot name** — writing `{SN}` in the Spanish for
*sintagma nominal* reads better and buys nothing, because no UI renders the raw
marker; a second name can only fail to match the first. And **fillers come in
two kinds**: chunk ids, and `literal_fillers` for names, places and numbers.
Unit 1 forced the second — `My name is`, `I'm from` and `This is` are all
frames wearing a chunk's clothes, and their fillers ("Alex", "Mexico") are
things the curriculum will never teach as chunks. Literal fillers are gated by
the same readability scorer as everything else, so they are a licence to use a
word the learner already has, not a hole in the 95% rule.

**Ear training is human-recorded, never TTS** (§8.1B). The voice roster schema
*refuses* an `hvpt` role. High-variability training works because talkers vary;
six synthetic voices produce a drill that looks right in the UI and teaches much
less. `content/speakers.yaml` holds the human roster.

**One voice per character, forever** (§4.3). `content/characters.yaml` is the
only place a scene voice is decided. Scene transcripts address the cast by id
(`ANA:`, `MIGUEL:`); an unknown speaker tag is a hard validation failure, which
is how anonymous walk-ons stay out of the story.

**No `ease` column.** The scheduler is FSRS (`ts-fsrs`), which models memory as
stability + difficulty. SM-2's ease factor has no equivalent. §9's field list
predates the scheduler choice.

**No `audio-content` bucket.** §8.3 names one; §8.1C then moves content audio to
the CDN because Storage egress binds first. Storage is `user-recordings` only.

**`learned` is a CHECK constraint,** not service-layer logic:
`check (state <> 'learned' or produce_passes >= 2)`. The most load-bearing
pedagogical rule in the product does not belong somewhere a code path can miss.

**A stage with no content is skipped, not shown empty.** `availableStages()`
in `lib/session/stages.ts` counts what a unit can actually serve and drops the
rest. Today `b1_u1` serves three of five — no human recordings means no `ear`,
no seeded dialogue means no `speak` — and the learner sees "Paso 1 de 3", not a
gap they cannot explain. This is Phase 1's exit criterion ("no dead end") as
code: a stage that plays silence *is* the dead end. Both stages light up on
their own the moment their content exists; nothing needs changing to enable
them.

**A chunk is "met" exactly when it has a `user_cards` row.** Not a cursor on
the session or a counter on the profile. That is what makes an abandoned Meet
introduce nothing, a resumed one show the same phrases, and "which chunks are
new" answerable without any state that can drift from what the learner actually
saw. It is also why `StageInventory` carries one per-learner number: a unit
whose chunks have all been met has no Meet left in it, and the stage is skipped
rather than shown empty.

**The grader forgives form, never meaning.** Case, punctuation, accents,
contraction and a length-scaled typo budget are all *form* — a beginner who
typed the right English should never be told otherwise. Whether "Thanks" is an
acceptable answer for "Thank you" is a judgement about the language, and it
belongs to whoever wrote the content: that is `chunks.accepts`, deliberately
empty for almost every chunk rather than a synonym dictionary.

**A distractor is only a distractor if choosing it is a real mistake.** Wrong
answers are drawn from everything the learner has met, not from the handful due
today — a same-session pool is semantically clustered by construction, because
a unit introduces greetings together and farewells together.

**A known transfer error is never forgiven as a typo.** `gradeTypedAnswer` has
a generous typo budget, and "Am fine, thank you" is one character from "I'm
fine, thank you" — so it sailed through as a near-miss *and counted toward
mastery*, which would have let a learner reach `learned` while dropping the
subject pronoun every single time. Now a match against `ERROR_PATTERNS` forces
`wrong` before the edit-distance check runs. Found by typing it into a browser
on 2026-08-28; no test would have caught it, because the rule it broke had not
been thought of yet.

**A mission is never failed.** `mission_reports.attempted` is always true and
exists to be reported on, never to gate. Both feelings questions are optional —
pressing *Listo* with nothing selected files a complete report. Someone who just
made themselves uncomfortable on purpose should not have to rate their own
discomfort as the price of admission.

**Nothing in F8 can go down.** No path lowers `total_xp`, resets
`days_practiced`, or marks a quest failed; an unfinished quest simply ends the
day and is replaced. `/home` carries no countdown, no "your streak is at risk",
nothing red. The soft consecutive counter may quietly reset to 1 and is never
announced — there is no copy for breaking a streak because the product does not
have that idea. `total_xp >= 0` is a CHECK, so a bug that subtracts cannot land.

**XP rewards the behaviour, not the result.** `xpForSession` takes no accuracy
argument and should never gain one — a learner who stumbled through a speaking
task did the thing the product exists to make them do. Speaking is worth more
than any other single act, because it is PRD 3's headline metric and the one
thing a beginner is most likely to avoid.

**A unit is finished on coverage, not on mastery.** `isUnitComplete` asks only
that every chunk has been met and every scene heard. Requiring each chunk to
reach `learned` would stall a learner behind fifty production passes, and it is
unnecessary: the review queue is not unit-scoped, so unmastered chunks keep
coming back long after the unit is behind them. Both halves of the rule are
load-bearing — chunks alone would move a learner past the last scene, and scenes
alone would move them on with phrases they had never been shown, because
`pickSceneIndex` wraps.

**Running out of curriculum is a state, not an error.** With one authored unit
every learner reaches the end in about six sessions. `nextUnit` returns null,
the learner stays put, and `/home` says so plainly ("Ya viste todo lo que hay por
ahora") with the button relabelled *Repasar*. The session still runs — Meet is
skipped, the story wraps, the review queue and speaking task are untouched —
which is the no-dead-end rule holding at the one place it is actually reachable
today.

**Marking is biased toward the learner, deliberately.** `gradeTypedAnswer`
ignores case, punctuation, spacing and accents, and forgives an edit-distance
typo that scales with phrase length. A beginner who typed the right English and
was told "no" over a missing apostrophe does not blame the apostrophe. A
near-miss still counts as production: they said the phrase, and this is a course
about speaking.

**Only production matures a card, and the database is the one enforcing it.**
`countsAsProduction` refuses recognition passes, and `cardStateFor` claims
`learned` only with two production passes behind it — which is exactly what the
`learned_requires_production` CHECK will accept. The app is written so it never
generates a write the database would reject, rather than trusting itself.

**Reviews are written per card, not per stage.** Everything else in the session
batches its writes on the way out; Retrieve does not, because in a
spaced-repetition system the review history *is* the product.

**Ear training never repeats a talker back to back.** That single rule in
`buildDrill` is the entire mechanism — high-variability training works because
the talkers vary, so a learner builds a category instead of memorising a voice.
A drill that repeats a speaker still looks and feels correct and teaches
substantially less, so `buildDrill` runs short rather than repeat one.

**Comprehension options are shuffled, seeded on the session.** `b1_u1` was
authored with **all eighteen** scene answers at option 1, so tapping first every
time scored full marks without listening — the check measured nothing.
`npm run content:validate` now warns when a unit's answers all share a slot, and
`shuffleQuestion` reorders them regardless, so no unit can have the problem
however it was written. Seeded rather than random because a refresh mid-question
must not rearrange the answers under the learner.

**Meet writes cards on the way out, with `ignoreDuplicates`.** On the way out so
that abandoning the stage costs nothing; `ignoreDuplicates` rather than a plain
upsert because an upsert would rewrite `gloss_reveals` and `produce_passes` on a
card that already exists, silently erasing review history if the advance ever
runs twice. `tests/session.test.ts` asserts exactly that.

**The current stage is server state, never a URL segment.** It lives in
`sessions.stage_reached`. A stage in the URL is a stage a learner can type, and
the order is pedagogical — retrieval before the chunks have been met is a quiz
on material never shown. It also makes resuming free: the resume point and the
render point are the same value.

**Time on task is measured on the client and sent with each advance.**
`sessions.duration_s` feeds PRD 3's counter-metric, so it has to be honest. A
session resumed the next morning would otherwise report the whole night as
practice if the server just diffed `started_at`.

**Email confirmation is OFF.** F1 asks for confirmation *and* signup→session in
under two minutes; those conflict. Decision was confirm-later. Supabase has no
native "let them in, verify afterwards" mode, so the app must trigger its own
verification when an address has to be real (password reset, D17 reminders).
**That part is not built yet.**

**The adaptive placement test is deferred** (D19 is P1/Phase 2). Onboarding
screen 3 says plainly that you start at the beginning. The query behind it
already sorts by curriculum order, so the real test drops in without touching
the page.

**Audio URLs go to `audio-manifest.json`, not back into the YAML** (§F9 says
otherwise). Rewriting 25 chunks × 4 voices inline would bury the authored
content under generated noise.

---

## Traps — things that cost time once already

**The clip hash must include everything that changes the bytes.** It had the
text, the voice and the provider, and not the rate — so editing `rate_wpm`
produced a green "0 to generate (1414 cached)" and the old audio. Fixed by
hashing the effective `length_scale`; then found again the same afternoon when
`natural_wpm` changed and the hash still had only `rate_wpm`. The rule: hash
the *derived* parameter the engine actually receives, not the inputs you
happen to remember.

**`length_scale = natural_wpm / rate_wpm`, and scale > 1 is slower.** So to
correct a voice that renders too fast you *raise* `natural_wpm`:
`natural' = measured × (natural / rate)`. It was applied the other way once —
Ana went from 158 wpm to 177 against a declared 140 — and cost a full
regeneration. The formula is now in `voices.yaml` next to the numbers.

**A killed audio run used to lose its bookkeeping.** The manifest was written
once, at the end; a run killed at clip 612 of 644 left 612 correct files on
disk and a manifest that said none existed, and the next run synthesised all
of them again. `generate-audio.ts` now adopts any clip already on disk under
its content hash (one `ffprobe` each) and checkpoints the manifest every 50
clips. Long runs are still foreground — `--only=chunk|example|scene_line`
splits them under the 10-minute limit — but a timeout now costs at most 50
clips.

**The per-scene rate gate bounds noise around *authored* variation now, not
uniformity.** `MAX_SCENE_SPREAD` went 1.25 → 1.45 when the cast was given
deliberate rates: a scene samples a few lines per voice, and a line that is a
list (`five, one, two, nine, eight`) is mostly pauses, so in-scene spreads run
~15% wider than the declared 1.24×. The gate still catches an engine that
ignores the roster; it no longer flattens the cast.

**Some filler classes are closed, and a threshold they cannot reach is noise.**
`RECOMMENDED_FRAME_FILLERS` was 8, which was aspiration rather than arithmetic:
a week has seven days, so `I work on {DAY}` can never satisfy it however well
it is authored, and the male relatives an A0 learner has met number five. It is
now 5, which still catches the real failure (a three- or four-filler frame is a
handful of chunks wearing a pattern's clothes). The general lesson is the same
one the speech-rate gate taught: **a check that cannot be satisfied gets
deleted, so fix the threshold before blaming the content** — but only after
checking the content genuinely cannot do better. `f_0010` could hold more
times, so it was extended rather than excused.

**A wrapped transcript line has no speaker, and the parser is right to reject
it.** YAML block scalars keep the continuation line, so
`MARIA: ... every morning,\n  same thing.` parses as a second line whose
speaker tag is empty — which fails cast validation with `"" is not in the
cast`. Keep one turn per line, however long.

**An accent truncated the word, and the content taught the truncation.**
`tokenize("café")` returned `["caf"]` — the accented letter is not in `a-z`, so
it *split* the word instead of being part of it. "caf" is not a word and not a
cognate, so `café` was an unknown token everywhere. What hid it is the nastiest
part: the chunk and the scene both produced "caf", so they **agreed with each
other**, the 95% rule passed at 100%, and `b1_u4` was on course to ship a card
teaching a nonsense string. `tokenize` now strips diacritics before splitting.
Caught by the vocabulary schedule, which refused to release a word called
"caf" — the first time that check earned its keep on something nobody had
thought of.

**A scene needs ~85+ tokens or it falls under the 30s floor.** Measured across
four units: roughly **0.39s per token**, so 63 tokens is 25s and fails PRD F4,
while 90 lands near 38s. Worth knowing before writing rather than after
generating, because each round trip is a few minutes of Piper.

**A released word is not a taught word, and the 5% budget will hide the
difference.** `their` was released for `b1_u3`, used in a scene, and taught by
no chunk — so it sailed through at 99% as an allowed unknown rather than
failing. The schedule check only catches words a unit *teaches*; a word a scene
merely *uses* is governed by the readability budget, which is designed to
absorb exactly one or two of them. If a scene reports `new:` anything, that is
a gap, not a pass.

**A scene with no generated audio used to validate clean.**
`checkGeneratedDurations` skipped any scene missing from the manifest, so an
interrupted `content:audio` run left a unit that passed `content:validate` with
a green tick and zero playable scenes — the duration checks simply did not
happen. Found when `b1_u3` passed with **0 of 6** scenes stitched. There is now
a `gate()` for it (warning while authoring, error at publish), matching how
missing chunk audio is already handled. The general shape is one this project
keeps meeting: **a check that skips missing data reports success for absence.**

**Long audio runs must be foreground.** `npm run content:audio` on a new unit
is a few minutes, and backgrounding it — `&`, `nohup`, or a background Bash
call — got the process reaped partway through twice, once at 25 of 204 clips.
The manifest is written only at the end, so a reaped run leaves no trace beyond
missing scenes. Run it in the foreground with a raised timeout.

**Words per minute is not a speaking rate.** It is a speaking rate divided by
word length, and word length belongs to the *text*. Authoring `b1_u2` pushed
the whole cast from 157 to 176 wpm and every voice looked like a regression —
while the physical rate moved **3.24 → 3.38 syllables per second**, which is
nothing. The unit is simply monosyllabic (1.16 syllables per word against unit
1's 1.26) because numbers and function words are short. Uncorrected, every unit
teaching numbers would have failed the gate forever, and a gate that cries wolf
gets deleted. `lib/content/speech-rate.ts` now measures syllables and reports
words, normalised to `SYLLABLES_PER_WORD`. Same lesson as `MIN_WORDS`: **fix
the measurement before accusing the content.**

**The audio manifest kept clips for lines that no longer existed.** It is
loaded and merged into, so an edited transcript leaves its old entry behind
forever — the new line hashes differently and never overwrites it. That is not
untidy, it is three bugs: the stale entry claims its file, so `pruneOrphans`
treats the file as live and never deletes it; it counts toward the per-unit
download budget; and it is fed to the speech-rate gate, where a deleted line
goes on dragging a voice's average around. Caught because removing one of
Carlos's lines made a scene's speaker spread *worse*. `pruneStaleEntries` runs
before `pruneOrphans` — order matters — and dropped **21 dead entries and 21
orphan files** on its first run.

**A test that manufactures its own fixture goes stale silently.** The
progression test created a throwaway `zz_test_u2` because b1_u1 was the only
authored unit, and asserted the learner advanced to it. Authoring `b1_u2` made
that assertion wrong — the learner correctly advanced to the real next unit —
and the test failed for the one reason that is good news. It now derives the
expected target from curriculum order, so authoring `b1_u3` will not break it.

**Readability was inflated two ways, and both were found by planning `b1_u2`
rather than by any test.** Inflation is the dangerous direction: a scene that
scores too low gets rewritten, and one that scores too high ships.

1. **The `ty` → `dad` suffix rule credited every number from twenty to
   ninety** as a free cognate ("twendad"), plus party, dirty, empty, pretty and
   safety. A Spanish speaker gets nothing free from `twenty` — *veinte* shares
   not one letter. `b1_u2` is the numbers unit, so this was about to land
   exactly where it did most damage. Removed. It did catch true cognates
   (difficulty, liberty, property) and `ity` does **not** cover them —
   `difficulty` ends in `lty` — but all of those are Latinate B1+, above where
   this course now ends, while every false positive is core A0. `difficulty` is
   curated instead. **The suffix rules construct a Spanish word and never check
   it exists**, which is the general failure: `payment` → "paymento" sailed
   through. `suffix_exceptions` in `cognates.yaml` is the only guard.
2. **`morphologicalVariants` stripped a trailing `s` unconditionally**, so
   `his` → `hi` and `its` → `it` — and both bases are taught in unit 1, so two
   distinct high-frequency function words were free. Length cannot separate
   these (`days`, `eyes` are the same size and are real plurals), so
   `NEVER_DECOMPOSED` is a list.

Unit 1 was unaffected — its scenes score 100% with **zero** cognate credit — so
this was latent, not historic. Pinned by `tests/content.test.ts`.

**`produce_spoken` has no emitter, and that is the feature.** It is a legal
review mode, `countsAsProduction` returns true for it, and `learned` needs two
production passes — guarded by a CHECK because it is the most load-bearing
pedagogical rule here. Wiring the Speak stage to emit one looks like closing an
obvious gap. It would instead let a learner tap *Ya lo dije* twice and reach
`learned`, because speaking is **self-reported**: no pronunciation score, no
pass mark, by design (PRD 4.5). The mode is right and should stay — a
*verified* spoken pass belongs in `countsAsProduction`, and on-device
recognition could yet make one possible at $0. What must never happen is a tap
wearing its clothes. Speaking is counted in `sessions.speaking_tasks_completed`,
server-side, where it cannot inflate mastery.
`tests/spoken-production.test.ts` fails the build if a new file references it.

**Frames are live end to end as of 2026-08-28** — schema, `frames` table,
seeder, and a second phase in Speak. `b1_u1` has three. The trap this closes is
worth remembering: for one commit the type existed and nothing could display
it, which is exactly the `l1_support_level` mistake (written on every unit
advance, read by nothing — until it was finally wired on 2026-08-29). **Wire a
stage before authoring at scale.**

**macOS `say` silently substitutes the default voice** when a named voice is not
downloaded. No error, plausible output. Block 1 shipped with `us_f_1`, `us_m_1`
and `uk_f_1` all being Samantha — 75 of 81 multi-voice texts were byte-identical
waveforms, so every "conversation" was one talker playing all parts. The
pipeline now synthesises a probe line per voice, decodes it, hashes the PCM, and
aborts on a collision. **Compare decoded audio, not files** — Ogg randomises its
stream serial, so identical audio yields different bytes.

**`force row level security` breaks signup.** It subjects the table owner to its
own policies, which blocks the `security definer` trigger that creates a profile
row in a table with no insert policy. It also buys nothing — the service role
has `BYPASSRLS` and bypasses FORCE anyway. The migration says so at the exact
line where someone would add it back.

**Browse `next dev` at `localhost`, never `127.0.0.1`.** Next 16 blocks
cross-origin dev resources, so `127.0.0.1:3000` loads the SSR HTML and then
silently refuses `/_next/hmr` and the dev client bundle. The page renders, looks
correct, and **never hydrates** — no client component runs, no `onClick` works,
and it presents as "my component is broken" rather than as a server warning. The
only evidence is one line in the dev server log:
`⚠ Blocked cross-origin request to Next.js dev resource /_next/hmr`. Either use
`localhost` or set `allowedDevOrigins` in `next.config.ts`.

**It is `proxy.ts`, not `middleware.ts`.** Next 16 renamed the convention. Every
Supabase SSR example still says middleware. Also: `@supabase/ssr` now passes a
second `headers` argument to `setAll` carrying `Cache-Control: private,
no-store` — dropping it lets a CDN serve one learner's session token to the next
visitor. The widely-copied snippet predates it.

**The `sb_secret_` key does not work on this project.** It 401s against
PostgREST; the legacy `service_role` JWT succeeds. `lib/supabase/env.ts` accepts
either name.

**`lib/supabase/database.types.ts` is generated — never edit it.** Hand-written
schema types go in `lib/supabase/types.ts`, which derives from it.

**`users.current_unit` is a foreign key with no cascade.** A test that creates
a throwaway unit, points a learner at it, and then deletes it will fail the
delete — silently, if the error is not checked — and leave the row behind to
break the *next* test that counts units. Move the learner off first. The general
lesson: check `error` on cleanup writes, or cleanup that never worked looks
exactly like cleanup that did.

**Build test fixtures with the admin API, never public `signUp`.** Hosted
Supabase rate-limits signups per project per hour, so a suite that creates each
fixture by signing up starts failing *every* test with "Request rate limit
reached" once it has been run a few times — and the symptom is a
`Cannot read properties of null` deep in a helper, which says nothing.
`admin.auth.admin.createUser` + `signInWithPassword` is not rate-limited;
`rls.test.ts` always did it this way. Public `signUp` now appears once, in the
two `onboarding.test.ts` tests that are actually about signup.

**Audio cannot be verified through the Chrome automation harness.** Confirmed
by hand afterwards that Meet's playback is fine, so this is a harness limit and
not a code smell — but it means every audio path has to be checked by ear. A plain
`new Audio(url).load()` typed straight into the page console sits at
`readyState 0`, `networkState 2`, no network request and no error — media
loading simply does not happen in that context. It presents exactly like a
broken player. Check the server instead (`curl -I` for a 200, the right
`Content-Type`, and a 206 on a `Range` request) and cover the timing logic with
pure tests (`tests/transcript.test.ts`); then listen to it in a normal browser
by hand. **Nothing in Meet or Absorb has had its audio heard.**

**An unknown Piper flag is not an error — it is content.** The provider passed
`--download-dir`, which Piper 1.7 does not have; instead of failing, argparse
handed the value to stdin and **the voice read the filesystem path aloud**. It
exits 0 and writes a well-formed Opus file, so the pipeline reported success.
The first engine spike was 120 clips of a voice reciting a path, and listening
to it would have ruled Piper out. Caught only by measuring: clip length tracked
the length of the *path* (9.5s long, 3.2s for `/tmp/vv`, 2.1s with the flag
removed), not the sentence. **Check any new flag against `piper --help` for the
installed version.**

**Measure speech rate on clips long enough to be speech.** Fixed overhead —
head/tail silence, a comma, ~0.2s at a sentence boundary — is ~19% of a
four-word clip and 12% of a six-word one. At four words, `"Tom, I'm from
Mexico."` reported 104 wpm for a voice averaging 162, and that artefact was
enough to fail a whole scene. `MIN_WORDS` is 6, and the per-scene check now
needs 3 samples per voice before it will accuse anyone — the voice-level check
always had that guard and the scene-level one did not.

**`getUser()` returning null does not mean "signed out".** It returns null when
it cannot reach the auth server too, and with no session cookie the client
short-circuits before touching the network — so a dead backend and an ordinary
signed-out visitor produce a *byte-identical* `AuthSessionMissingError`. The
only reliable liveness signal is a query against a public-read table: a
reachable project answers even when the answer is a permission error, while a
dead host gives an empty `error.code` and `fetch failed`.

**A redirect is not an HTTP failure.** The keepalive workflow originally pinged
`/api/health` while that path was not in `PUBLIC_PATHS`, so it 307'd to `/login`
and `curl --fail-with-body` exited 0. It would have reported green forever while
checking nothing. Any external monitor must assert on the body or be pointed at
a public path — preferably both.

**A green test suite says nothing about whether the product is fair.** All
four defects above sat under 222 passing tests. The tests verified that
`gradeTypedAnswer` was *lenient*, that `buildOptions` returned three options,
that questions shuffled — each part correct, none of them asking whether a
beginner meeting the whole thing gets a fair first session. Both of the
pedagogical defects found before these were also found by a human in a browser.
**Assume the remaining ones are there too, and that only use will find them.**

**`onClick={handler}` passes the click event as the first argument.** Wire a
Server Action's wrapper straight to `onClick` and React hands it a
SyntheticEvent, which crosses the boundary as an opaque client reference and
kills the whole action with *"Cannot access length on the server. You cannot dot
into a temporary client reference from a server component."* — an error naming
neither the button nor the argument. TypeScript cannot catch it: a mouse-event
handler is a legal `(x?: string[]) => void`. Wrap it (`onClick={() => f()}`) and
guard the argument at the top of the handler. Cost an hour on 2026-08-28.

**Find-then-insert needs a unique index, not care.** `openSession` looked for an
open session and created one if absent, and a prefetch racing the navigation
behind it produced two. `sessions_one_open_per_unit` (partial, `where
completed_at is null`) now makes the second insert fail with 23505, which
`openSession` catches and re-reads. Any other find-then-insert added later needs
the same treatment.

**Server Actions need `refresh()` from `next/cache` in Next 16.** An action
that mutates the database and returns leaves the client router holding the old
RSC payload — the stage advances in Postgres and the screen does not move.
`revalidatePath` also works but says something it does not mean here (nothing
is cached; the page is dynamic). `refresh()` is the Next 16 idiom and only
works inside a Server Action.

**React's `onClose` on `<dialog>` silently never fires.** The `close` event
does not bubble and React does not attach a direct listener for it, so
`<dialog onClose={...}>` type-checks, renders, and does nothing — the
dismissal is lost for both the close button and Escape. Bind it with
`addEventListener("close", ...)` in an effect. This cost a full browser
debugging round; it is invisible to `tsc`, to lint, and to a code read.

**`Date.now()` during render fails lint.** The React Compiler's purity rule
rejects `useRef(Date.now())`. Start clocks in an effect — which is also more
correct, since a re-render would otherwise restart the timer.

**`getUser()`, never `getSession()`,** in anything gating access. A session read
from a cookie is client-supplied data.

---

## Open, roughly in order

0. **Run the ASR spike on a phone.** `/spike/asr` is live and public. One
   number — `recogniseMs` on a cheap Android — decides whether on-device
   speech recognition (`docs/ROADMAP.md` #2) gets built or parked. Half a
   minute to run; nobody has the number yet. Delete the route afterwards.

1. ~~Commit everything.~~ Done — `b267c88`.
2. **Look at F1 in a browser.** Verified: routing, data, markup. Not verified:
   whether it *feels* right. Walk `/` → `/signup` → onboarding in a narrow
   window. The test is the PRD's: would a nervous 19-year-old quit at this
   screen?
3. **Native-speaker review of `lib/copy/es.ts`** — ~120 lines, an explicit F1
   acceptance criterion, and not something to sign off alone.
4. ~~**The TTS engine is undecided.**~~ **Decided 2026-08-28: Piper**, by ear,
   before Block 2 was authored — which is what PRD 10 asks for. All 214 clips
   regenerated. The speech-rate gate now passes: every voice is within 6% of its
   declared rate and the spread across the cast is **1.10x** (was 90–136 wpm,
   spread 1.69x, on macOS). `npm run content:publish-check` went from 17
   blocking errors to 7, and all 7 are the ear-training gap in item 5.

   **Local setup is required and is not in the repo** (`.venv/` is gitignored,
   ~1.1 GB):
   ```bash
   python3 -m venv .venv                       # Homebrew python refuses system
   .venv/bin/pip install piper-tts             # installs (PEP 668)
   .venv/bin/python -m piper.download_voices \
     en_US-amy-medium en_US-ryan-high en_US-joe-medium \
     en_US-kristin-medium en_US-lessac-medium en_GB-alan-medium \
     --data-dir .venv/piper-voices
   export PIPER_BIN=$PWD/.venv/bin/piper PIPER_DATA_DIR=$PWD/.venv/piper-voices
   ```

5. **No ear-training audio exists.** 0 of 300 recordings for `ee_ih`. Six people
   × 50 words ≈ a weekend of favours. `npm run content:recording-kit --
   --contrast=ee_ih` writes each of them a script. Until then Stage 1 of the
   daily loop has nothing to play and `npm run content:publish-check` fails —
   correctly. The session player already skips the stage cleanly, so this
   blocks nothing except the stage itself.

   **Recruit for variety, not convenience.** Six talkers from one town gives
   you the drill without the mechanism — high-variability training works
   *because* the talkers genuinely vary. With a scripted recorder, ~150–250
   words/hour is realistic, so all nine contrasts is ~2–3 hours per speaker.

   **The priority order is probably wrong, and `th` is the reason.** It is the
   most famous marker of a Spanish accent and one of the lowest-payoff
   contrasts in English: `think`/`sink` confusions almost never survive
   context, and Jenkins' Lingua Franca Core excludes the dental fricatives from
   what is needed for intelligibility. Meanwhile `/æ/–/ɛ/` (`bad`/`bed`,
   `man`/`men`) is high functional load for a five-vowel L1 and **is not in our
   nine at all**. Changing the roster is a Postgres enum migration on the type
   behind `target_contrast`, not a re-sort of a list — real, but cheap, and far
   cheaper before 2,700 clips exist than after. Note also that
   `final_clusters` is not a minimal-pair contrast (`walked`/`walk` is
   presence-vs-absence) and needs a categorical *"past or present?"* exercise,
   which is a second UI shape nobody has budgeted for.
6. ~~`public/audio/` is gitignored.~~ Resolved 2026-08-27: committed and served
   from Vercel's CDN with immutable cache headers, per §8.1C. Full curriculum
   projects to ~78 MB at 24 units. **Do not plan against the bandwidth number**
   — the curriculum is ~5,100 files and each is an edge request, so requests
   bind roughly 6× sooner than megabytes do. `docs/DEPLOY.md` has the corrected
   maths.
7. **Content: 6 units of 24 — Block 1 is complete.** Authoring is ~70% of total
   effort and it is the only thing between this and a finished course.
   `docs/CONTENT-BRIEF.md` has the sourcing research, the licences, and the
   sequenced estimate: **~220–310 person-hours to a finished A2**, of which the
   first 40–55 were foundations that make everything after them 2–3× faster.

   All three foundations are done:

   a. ~~**Wire a stage to frames.**~~ Done 2026-08-28 — Speak displays them,
      and Block 1 carries 12.
   b. ~~**Freeze a vocabulary release schedule.**~~ Done for Block 1 (202 word
      types across six units). **Blocks 2–4 are still empty.**
   c. ~~**A story bible.**~~ Done — `content/STORY.md`, now also carrying the
      six Block 1 beats as written rather than as planned.

   **Each of `b1_u2`–`b1_u6` took one pass plus validator iteration**, which is
   the whole argument for having built the foundations first.

   **Block 1 is finished.** The next real work is a vocabulary schedule for
   **Blocks 2–4**, and it is the one thing here that cannot be derived from
   this repo: Block 1's 202 word types were planned from first principles
   because A0 vocabulary is close to forced by the can-do statements, and that
   stops being true at A1+. NGSL / NGSL-Spoken (CC BY-SA 4.0, commercial use
   permitted) is the source — and note the **ShareAlike**, which a derived
   wordlist inherits. Until that exists, the remaining 18 units are blocked on
   a decision nobody should make by taste.

   Then author. LLM-assisted drafting at *build* time is consistent with the
   $0 rule ($0 is about runtime) and is realistically the only way one person
   ships 24 units — but the human passes are not optional: naturalness, Spanish
   register, story stakes, distractor quality, and a cultural read on anything
   touching immigration, police, employers or clinics.
8. **Email verification flow** — see the confirm-later decision above.
9. **Confirm Supabase's inactivity policy in the dashboard.** The keepalive
   (`.github/workflows/keepalive.yml`, daily) assumes a read counts as
   "activity". That is a **bet, not a guarantee** — the vendor's definition is
   not documented precisely enough to rely on, and it was never verified. Check
   that the project has not paused before trusting it. Note also that GitHub
   disables scheduled workflows after 60 days of repo inactivity, so a quiet
   summer stops the heartbeat.

10. **Listen to the audio — partly done.** Confirmed by ear on 2026-08-28:
   **Meet plays, and its four voices are audibly distinct.** That is worth more
   than it looks — it is live confirmation that the macOS `say` voice-collision
   trap (see traps) is not recurring, i.e. the pipeline's probe-hash guard holds
   all the way through to the browser.

   Still unheard, because the automation harness cannot load media at all:
   **Absorb** (does the scene play, does the highlight track the line, does
   tapping a line seek to the right sentence) and **Retrieve** (does the card
   clip play when the answer is revealed). Both are a couple of minutes in a
   real browser.

   **This got more urgent, not less.** There are now **36 scenes and 1,287
   clips** riding on timings nobody has heard, and the audio pipeline has
   shipped three separate bugs this week that only measurement caught — a
   voice reading a filesystem path aloud, a rate gate measuring the wrong
   thing, and a manifest keeping clips for deleted lines. Every one of them
   produced well-formed files and a green pipeline. Ears are the only check
   left that has not been run.

   Also still unheard: the **frame step in Speak** and everything in
   `b1_u2`–`b1_u6`.
11. ~~`speaking_task` is authored but never seeded.~~ Resolved 2026-08-28: the
    unit's speaking task now seeds into `dialogues` and the stage is live. The
    task gained a `character` field, because `dialogues.character_id` is a
    not-null foreign key and an anonymous partner would be the one voice in the
    product belonging to nobody.
12. ~~`ts-fsrs` is in `devDependencies`.~~ Moved to `dependencies` 2026-08-28.
13. **Speaking-task lines have no audio.** The audio pipeline covers chunks,
    examples and scene lines, but not the `speaking_task` script, so the AI half
    of a conversation is read rather than heard. Adding it means extending
    `buildAudioPlan` and regenerating — worth doing with the TTS engine decision
    (item 4), not before.

### What is left, and why

Everything buildable without new content or new decisions is built. Two
features remain designed-but-unbuilt, both blocked on authoring:

| Feature | Blocked on |
|---|---|
| **Branching dialogue** (`dialogue_runs`) | `dialogues.nodes` holds a flat script; `guided` and `open_response` modes need authored node trees. |
| **The visible L1 taper** | ~~Half-built~~ **Built 2026-08-29.** What remains is content, not code: no unit authors `q_en`, so levels 3 and 5 are identical in Absorb until one does, and `lib/copy/es.ts` has no English chrome — the taper reaches the *material*, never the interface. Both are authoring, and both light up on their own. |

Branching dialogue is the last one, and it is blocked in a way missions were
not: a `guided` dialogue asks the learner to choose what to say, and the
validator enforces `scripted` for A0 precisely so a beginner never has to invent
a sentence. Authoring one for `b1_u1` would contradict the taper. It belongs in
a unit that does not exist yet — so the walker is worth building only alongside
the first A1 unit.

### Next feature

The daily loop is complete and **Block 1 is authored**: a learner can walk
`/home` → Meet → Absorb → Retrieve → Speak → `/home` for about 36 days before
running out. Ear is built and skipped until its recordings exist.

What Phase 1 still needs, in order of what actually blocks the exit criterion:

1. **Hear the audio.** Meet has been confirmed by ear; **Absorb and Retrieve
   never have**, and the automation harness cannot load media at all (see the
   traps). Two minutes in a real browser, and the cheapest item on this list by
   a wide margin. 36 scenes now depend on it being right.
2. **Ear-training recordings** (open item 5). Six people, fifty words each.
   This is the only thing standing between `content:publish-check` and zero
   errors, and the stage turns itself on the moment the files land.
3. **A vocabulary schedule for Blocks 2–4** (open item 7b). The one piece of
   work here that cannot be derived from this repo: Block 1's 202 word types
   were planned from first principles because A0 vocabulary is close to forced
   by the can-do statements, and that stops being true at A1+. NGSL /
   NGSL-Spoken is the source. **All 18 remaining units are blocked on it**, and
   guessing it by taste is precisely the mistake it exists to prevent.
4. **Blocks 2–4 themselves.** 18 units, and per `docs/CONTENT-BRIEF.md` the
   bulk of the remaining 220–310 person-hours.

Two things that are *designed and unbuilt* rather than blocked, both small:
`q_en` on scene questions (the taper reaches the material but never the
interface, so levels 3 and 5 are identical in Absorb today), and an English
chrome for `lib/copy/es.ts` at level 5.

**Authoring a unit now costs one pass plus validator iteration.** The three
foundations — story bible, vocabulary schedule, frame type — are what made that
true, and the heuristics that cost real time to learn are in the traps:
~85 tokens per scene, run audio in the foreground, `new:` in validator output
is a gap rather than a pass.

The seam for a new stage body is `SessionPlayer` in
`app/session/[unitId]/session-player.tsx`.

**Exit criterion for Phase 1:** 30 consecutive days of Block 1 with no dead end,
and $0 runtime cost confirmed in the network tab. **The content half is met**
— 36 days exist. What is unverified is the 30 consecutive *days*, which only a
real learner can produce, and the network tab, which nobody has opened.

---

## Commands

```bash
# content
npm run content:validate                  # schema + 95% rule + PRD rules
npm run content:publish-check             # same, warnings become errors
npm run content:audio                     # generate (idempotent, content-hashed)
npm run content:audio -- --provider=silent  # no TTS engine needed
npm run content:spike                     # engine A/B for the week-1 decision
npm run content:recording-kit -- --contrast=ee_ih
npm run content:seed                      # YAML + manifest → Supabase

# database
npm run db:push / db:reset / db:diff
npm run db:types                          # regenerate; never hand-edit
npm run test:rls                          # live isolation proof

# app
npm run dev / build / lint / test
```
