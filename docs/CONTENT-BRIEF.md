# Content: where it comes from

**Written 2026-08-28, updated 2026-08-29.** The app is finished. **Block 1 is
finished too** — 6 units, 152 chunks, 12 frames, 36 scenes, about 36 days of
content — so the Phase 1 exit criterion for volume is met. **18 units remain**,
and `content/README.md` calls authoring ~70% of total effort.

This file has three parts, in the order they happened:

1. **The prompt** below the line, written to hand to a fresh Claude session or
   any capable researcher. Copy-pasteable whole.
2. **The answer, fact-checked** — what came back, what it got right, what it got
   wrong about this repo.
3. **Round 2** — what was actually done with it, and the one thing still
   blocking. Also copy-pasteable.

**The finding that matters most, from six units of experience:** for A0 content,
sourcing was never the bottleneck. `b1_u2`–`b1_u6` were authored from nothing
external — no corpus, no licence, no dataset — at about one pass each. Phrases
like *"I don't understand"* are not scarce and no corpus will surprise you about
what a beginner needs to greet a neighbour. What was scarce was **knowing which
words were legal**, and `content/vocab-schedule.yaml` fixed that.

External sourcing matters for exactly two things now, and both are real:

- **Blocks 2–4 vocabulary.** At A1+, "which 300 words next" is a frequency
  question that should not be answered by taste. NGSL / NGSL-Spoken (CC BY-SA
  4.0, commercial use permitted) is the source. Note the **ShareAlike** — a
  derived wordlist inherits it. All 18 remaining units are blocked on this.
- **Ear training.** 2,700 clips, human-recorded, non-negotiable: HVPT works
  *because* talkers vary, so synthesising it produces a drill that looks right
  and teaches much less. Volunteers (~2–3 hrs each, $0) or Lingua Libre
  (CC BY-SA 4.0, already word-level citation form, so no forced alignment).

The prompt below still describes the project as one unit of thirty-six, because
that is what was true when it was sent and rewriting it would make the answer
that follows read as a response to something it never saw. Treat it as a
historical record; the current state is in the two sections after it.

---

## The prompt

> I need a research and planning answer, not code. Be specific and cite sources
> where a licence or a dataset is involved.
>
> ### The project
>
> **Hablar** is a free web app that teaches English to Spanish-speaking adult
> beginners. The archetype is a nervous 19-year-old immigrant who thinks he is
> bad at English, is surrounded by English he cannot yet use, and cannot pay for
> a class. It is built and maintained by one person in their spare time, and
> costs $0 to run — that is a hard constraint, not a preference.
>
> The software is done: a five-stage daily session (ear training → meet new
> phrases → absorb a scene → spaced-repetition retrieval → speak aloud), FSRS
> scheduling, real-world missions, L1-error detection, progress and streaks.
>
> **The course is not done: one unit of a planned thirty-six exists.** A learner
> exhausts everything in about six days. I need to work out how to produce the
> rest.
>
> ### What a unit is, exactly
>
> Content is YAML in the repo, validated by a schema before it can ship. One
> unit file contains:
>
> - **20–45 chunks** — whole usable phrases ("I don't understand", "What's your
>   name?"), never isolated vocabulary. Each has: English, a Spanish gloss, a
>   CEFR level, an English example sentence, a Spanish translation of that
>   example, tags, and optionally a list of alternative answers the grader
>   should accept.
> - **~6 scenes** — short dialogues, 40–55 seconds, between a **fixed recurring
>   cast** (Ana, Miguel, Maria, Carlos, Rosa, Tom — one permanent voice each).
>   The six scenes of a unit are one continuous story, not six unrelated
>   encounters. Each scene carries 3 comprehension questions in Spanish.
> - **1 speaking task** — a scripted conversation the learner performs aloud.
> - **2+ real-world missions** — something to do with an actual person outside
>   the app, each with an alternative for a learner who has no English speakers
>   nearby.
> - **1 target pronunciation contrast** from a fixed set of nine.
>
> ### The rules that make this hard
>
> 1. **The 95% rule.** Every scene must be ≥95% composed of words the learner
>    has already been taught, computed across the whole course sequence by a
>    validator. A unit can only use what previous units introduced. This makes
>    the curriculum a strict dependency ordering, not a list of topics.
> 2. **Chunks, not words.** The pedagogy is formulaic sequences — phrases a
>    beginner can deploy whole. Frequency word lists are the wrong shape.
> 3. **Fixed cast, permanent voices.** New characters are expensive; scenes must
>    be written for the people who already exist.
> 4. **Ear training must be human recordings, never synthesised.** High
>    variability phonetic training works because real talkers genuinely vary. I
>    need ~300 minimal-pair clips per contrast (25 pairs × 2 words × 6
>    speakers), for nine contrasts. **Zero exist.** Everything else is generated
>    locally with Piper TTS at build time, which is free and already working.
> 5. **$0 and no runtime AI.** Content is authored ahead of time and shipped as
>    static files. Nothing may require an API call while a learner is using it.
> 6. **Licensing must be clean and attributable.** Anything sourced from a
>    corpus or existing course has to be redistributable in a free app, with
>    whatever attribution its licence requires.
>
> ### The spine, and its arithmetic problem
>
> Six blocks, A0 → B1: introductions → daily life → transactions and directions
> → past and future → work → opinions. Cumulative chunk targets are 150 / 400 /
> 700 / 1,200 / 1,800 / 2,500. But the validator caps a unit at 45 chunks and
> there are 36 units, so the ceiling is 1,620 — and at the density actually used
> so far it is closer to 900. **Tell me whether the target, the cap, or the unit
> count is wrong**, and what a defensible endpoint is. If 2,500 memorised fixed
> phrases would not actually produce B1 ("can give and defend an opinion"), say
> so and say what would.
>
> ### What I want from you
>
> 1. **Sourcing.** Where do ~1,600 high-utility English chunks for Spanish
>    speakers actually come from? Assess concretely, with licences: open
>    corpora (spoken English in particular), public-domain and CC-licensed
>    course material, frequency and phraseology research, government or NGO ESL
>    curricula for adult immigrants. Say which are genuinely usable and which
>    are the wrong shape and would cost more to convert than to write.
> 2. **Spanish-specific selection.** What should this course teach that a
>    generic beginner course would not, given the L1? Cover: high-yield
>    cognates, false friends worth pre-empting, the pronunciation contrasts that
>    actually damage intelligibility for Spanish speakers (weighted by
>    functional load, not by how famous the minimal pair is), and the grammar
>    transfers worth designing around.
> 3. **An authoring method.** How does one person produce this at a sustainable
>    rate while satisfying the 95% dependency ordering? I am open to
>    LLM-assisted authoring at *build* time — the $0 rule is about runtime — so
>    tell me what a good pipeline looks like, what a human must check, and where
>    generated content would quietly degrade quality.
> 4. **The ear-training recordings.** Six speakers × 50 words × nine contrasts.
>    Options: volunteers, an open speech corpus mined with forced alignment
>    (assess whether excising words from read sentences ruins the acoustic
>    variability the method depends on), or paid recording. Give me a realistic
>    cost in hours and money, and which contrast to do first.
> 5. **A sequenced plan.** What to produce in what order to get from six days of
>    content to thirty, then to a coherent A2, then to B1 — with honest
>    estimates in person-hours. If the right answer is a shorter, deeper course
>    rather than 36 units, argue for that.
>
> ### How to answer
>
> Prioritise what a solo maintainer can sustain over what an ideal curriculum
> team would do. Where you are uncertain — especially about licences — say so
> rather than guessing. If you think the plan is wrong at the root (the unit
> structure, the 95% rule, the chunk-based approach, the 36-unit scope), say
> that first and argue it. I would rather be told now than at unit 20.

---

## Notes for whoever runs this

- Point the session at this repo. `content/README.md` is the authoring pipeline,
  `content/units/b1_u1.yaml` is the only complete worked example, and
  `lib/content/types.ts` is the schema the answer has to satisfy.
- The nine contrasts are in the `contrast` enum in
  `supabase/migrations/20260825120000_types.sql`, and only `ee_ih` is authored.
- `npm run content:validate` is the arbiter. Any plan that cannot pass it is not
  a plan.

---

## The answer, fact-checked (2026-08-28)

A response came back. It is worth reading in full, and the three items in §0 are
the most valuable thing anyone has said about this project. But it was written
from the brief, not from the repo, so parts of it describe a codebase we do not
have. Checked against source:

**Already built — do not build it again.** The recommendation to "build a
cognate whitelist and count it as known from unit 1" is `lib/content/cognates.ts`
plus `content/wordlists/cognates.yaml`, wired into `readability.ts` since the
pipeline was written. It holds **254 curated pairs, 16 generative suffix rules**
(`-tion`→`-ción`, `-ity`→`-idad`, …, so real coverage is far wider than 254),
**37 proper nouns**, and **50 false friends explicitly excluded**. Credit applies
at A0/A1/A1+/A2 and switches off above. The asked-for "~400–600 hand-vetted
entries with false friends excluded" is essentially this, already.

**Open question, answered: tokens, not types.** `scoreTokens` iterates every
token and divides by `tokens.length`. So the follow-on speculation — "if it is
type-based, that alone explains a lot of the pain" — does not apply. The
constraint already loosens as function words accumulate, exactly as predicted.

**The contrast list is not a reordering of ours.** Two entries in the proposed
nine (`/æ/–/ɛ/`, `/uː/–/ʊ/`) do not exist in our enum; the proposal also merges
`schwa` and `stress_intonation` into one slot and narrows `h_r` to `/h/`. Our
nine are: `ee_ih`, `schwa`, `final_clusters`, `b_v`, `s_onset`, `aspiration`,
`th`, `h_r`, `stress_intonation`. Adopting the proposal is a **Postgres enum
migration** on a type used by `target_contrast`, not a re-sort of a list. The
pedagogical argument (demote `th`, add `/æ/–/ɛ/`) still stands; the cost does
not, and was not priced.

**Unpriced elsewhere: ShareAlike.** NGSL and Lingua Libre are CC **BY-SA** 4.0.
Attribution was noted; copyleft was not. A wordlist derived from NGSL inherits
BY-SA, and 2,700 Lingua Libre clips carry per-file attribution obligations. Fine
for an open repo, but it is a compliance chore with a real hour count.

### What survives, and what to do with it

- **R2 (add a `frame` type) is correct and is the single best idea here.**
  Verified absent: no frame or pattern concept exists in `lib/content/types.ts`.
  ~200 frames × ~15 licensed fillers is the only proposal that changes the
  *shape* of the authoring problem rather than its size.
- **R1 (36 units lands at A2, not B1) is correct** and the hours arithmetic is
  sound. The cognate-discount caveat is right: Blocks 1–3 live in Germanic core
  vocabulary, and the Latinate windfall arrives above where this course ends.
- **R3a (relax scenes to 90%) — reject.** The support apparatus exists so a
  learner can work *comfortably* at 95%, not so authoring can push to 90%.
  Take the better idea buried in the same section instead: **weight unknown
  content words more heavily than unknown function words**, so a scene cannot
  pass at 95% with its 5% landing on the word carrying the point.
- **§4's "freeze the vocabulary release schedule first" is right** and is the
  main reason authoring feels adversarial today: the 95% rule is currently
  discovered at validation time instead of being a design input.

---

## Round 2 — what we did with the answer

**Copy-pasteable, like the brief above.** Everything below the line goes back to
whoever answered, so round 2 starts grounded instead of re-deriving the repo.

> Thank you — this changed the project. Two of your three root objections were
> adopted and are now committed (`85c49ae`). Here is exactly what happened,
> including where you were wrong about our codebase, so the next round does not
> repeat it.
>
> ### Adopted
>
> **R1 — the course now ends at A2 in 24 units, not B1 in 36.** Your arithmetic
> carried it, and the supporting point did more work than the hours did: the
> cognate discount arrives at B1+, which is exactly where the old spine stopped,
> so it was never going to rescue the gap. `content/curriculum.yaml` is four
> blocks; targets are 150 / 380 / 620 / 850 cumulative chunks. Blocks 5–6 are
> deferred, not deleted — the CEFR enum and the curriculum schema still admit
> them, so they return without a migration.
>
> We also split the metric as you suggested: `chunk_target_cumulative` and
> `frame_target_cumulative` are separate fields, because one frame with a dozen
> fillers is not one chunk. You were right that the old 2,500 was vocabulary-size
> research (word *families*) applied to chunks.
>
> **R2 — the `frame` type exists.** Schema, validator, known-word timeline, 18
> tests. `pattern` / `es_pattern` / `slot` / `fillers` / `literal_fillers` /
> `cefr`. The validator enforces: fillers must resolve to chunks taught **at or
> before** this unit (a forward reference is an error), every sentence the frame
> can generate is scored against the 95% rule, and a frame with fewer than 8
> usable fillers warns because the leverage ratio is the entire argument for the
> type. Each guard was proved firing against real content, then reverted.
>
> Two departures from your sketch, both deliberate:
>
> 1. **One slot name in both patterns.** Your example used `{NP}` in English and
>    `{SN}` in Spanish. No UI renders the raw marker — it becomes a blank or a
>    chooser — so a second name can only fail to match the first. Now enforced.
> 2. **`literal_fillers` had to be added,** and Unit 1 forced it. Three of its
>    "chunks" — `My name is`, `I'm from`, `This is` — are frames wearing a
>    chunk's clothes: none is a sentence, each has a hole, and the hole is filled
>    by a name or a place that the curriculum will never teach as a chunk. A
>    chunk-ids-only filler model could not express the most obvious frame in the
>    entire course. Literal fillers are gated by the same readability scorer, so
>    they license a word the learner already has rather than putting a hole in
>    the 95% rule.
>
> **Since writing the above, frames went live and Block 1 was finished.** The
> Speak stage displays them, `b1_u1`–`b1_u6` carry **12** of them, and the
> `l1_support_level` column that had been written-and-never-read is now a
> behaviour too. The leverage claim held: `I would like {NP}, please.` takes
> anything on a counter, and almost everything on a counter is a Latinate
> cognate our readability scorer already credits — one authored pattern, a
> dozen sayable sentences.
>
> ### Where you were wrong about our repo
>
> Not criticism — you answered from the brief, and the brief did not say. But
> round 2 should be grounded:
>
> - **The cognate whitelist you recommended building already exists** and has
>   since the pipeline was written: `lib/content/cognates.ts` +
>   `content/wordlists/cognates.yaml`. **254 curated pairs, 16 generative suffix
>   rules** (`-tion`→`-ción`, `-ity`→`-idad`, …, so coverage is far wider than
>   254), **37 proper nouns**, **50 false friends explicitly excluded**, credited
>   at A0–A2 and switched off above. That is essentially the "400–600 hand-vetted
>   entries" you asked for.
> - **Your open question answers itself: we count tokens, not types.** So the
>   follow-on ("if it is type-based, that alone explains a lot of the pain") does
>   not apply — coverage already climbs as function words accumulate.
> - **Your contrast list is not a reordering of ours.** `/æ/–/ɛ/` and `/uː/–/ʊ/`
>   are not in our enum at all; you also merged `schwa` with `stress_intonation`
>   and narrowed `h_r` to `/h/`. Ours are: `ee_ih`, `schwa`, `final_clusters`,
>   `b_v`, `s_onset`, `aspiration`, `th`, `h_r`, `stress_intonation`. Adopting
>   your list is a Postgres enum migration on the type behind `target_contrast`.
>   The pedagogy stands and we have recorded it; the cost was not priced.
> - **You flagged attribution but not copyleft.** NGSL and Lingua Libre are CC
>   BY-**SA**. A wordlist derived from NGSL inherits ShareAlike, and 2,700
>   Lingua Libre clips carry per-file obligations.
>
> ### Rejected
>
> **R3a — relaxing scenes from 95% to 90%.** The support apparatus exists so a
> learner can work *comfortably* at 95%, not so authoring can push lower. We took
> the better idea in the same section instead and will implement it: **weight
> unknown content words above unknown function words**, so a scene cannot pass at
> 95% with its 5% landing on the word carrying the point.
>
> ### What we need from you now
>
> **Block 1 is finished** — 6 units, 152 chunks, 12 frames, 36 scenes, 202
> distinct word types, every scene at 100% readability. Three of your five asks
> are therefore closed: we wrote the story bible, we planned Block 1's
> vocabulary, and the frame type is real and in use. Authoring a unit now costs
> about one pass plus validator iteration.
>
> That leaves one thing genuinely blocking, and it is the one we cannot do from
> inside this repo:
>
> 1. **A vocabulary release schedule for Blocks 2–4 (A1 → A2).** This is the
>    whole ask now. Block 1's 202 word types were planned from first principles
>    because A0 vocabulary is nearly forced by the can-do statements — "greet
>    someone, say your name" does not leave much room for opinion. At A1+,
>    "which 300 words next" is a real frequency question and answering it by
>    taste would be exactly the mistake the schedule exists to prevent.
>
>    Concretely: for each of the 18 units, which word types become legal, in
>    order, derived from NGSL-Spoken with function words first. Our format is
>    one YAML list per unit; a word is released once, in the earliest unit
>    allowed to use it. **Do not include cognates or proper nouns** — our
>    scorer credits those already (254 curated pairs, 16 generative suffix
>    rules, 37 proper nouns, 50 false friends excluded).
>
> 2. **Beat sheets for Blocks 2–4**, to sit alongside the schedule. Our
>    experience is that the beat has to come *first* and the vocabulary second,
>    or the beat asks for words the unit cannot legally use. The block arcs
>    exist (to belong → to manage alone → to have a voice); the per-unit beats
>    do not.
>
> 3. **The licence questions you flagged as open**, unchanged and still worth
>    resolving before anyone leans on them: the PHRASE List's actual status,
>    VOA per-asset confirmation, and We Speak NYC's terms.
>
> Deprioritised for now: the frame inventory. We would rather author frames
> alongside each unit than plan 200 in advance — writing them one block ahead of
> the units that use them is what keeps the fillers honest.

> Constraints are unchanged: $0 at runtime, no API calls during a session,
> content is YAML validated by `npm run content:validate`, ear training is human
> recordings only. Assume build-time LLM authoring is available.
