# What to build next, and why

> **v2 (2026-08-31) is at the bottom** — a second five-member review, run after
> items 1, 3–10 shipped, with every claim re-verified against the repo. It
> supersedes the ordering below where they disagree.

**Written 2026-08-29**, from a five-member review of the project at the end of
Block 1. `docs/STATE.md` says where things stand; this says what comes after,
in order, with the reasoning attached so the order can be argued with rather
than re-derived.

Two findings drive the whole list. Both were measured, not asserted.

**The course carries 34.4 minutes of English audio.** 11.5 min of chunks,
5.3 of examples, 17.5 of scene lines — across all 36 scenes. Over Block 1's 36
days that is **29 seconds of connected speech a day**. Block 1 is 12
learner-hours; 24 units projects to 48. Conventional guided hours to A2 from
zero are ~180–200. The B1→A2 rescope cut the endpoint and never re-derived the
density, so the new promise misses by *more* than the one it replaced. This is
not the $0 rule's fault — Piper is free and unlimited. It is that 100% of the
authoring budget goes to the *expensive* kind of content: material introducing
new words, which must fight the validator. Content written inside the 202 word
types already released passes trivially and costs a fraction of a unit.
`curriculum.yaml` already promised "an extensive listening library". It exists
nowhere.

**The loop matures cards on typing while the headline metric is speaking.**
`produce_typed` bypasses articulation; scripted read-aloud bypasses
*formulation* — the message→form step where fluency actually bottlenecks. The
daily loop trains neither half of the thing it exists to produce.

Everything below is ranked by effect on those two, per hour of one person's
spare time.

---

## Before any of it — not features

**One real learner, two weeks.** Every serious defect this project has had —
the 34.5% distractor collision, the grader rejecting *"What is your name?"*,
eighteen answers at option 1, `"caf"` — was found by a human touching the
product, never by the suite. 345 tests, zero learners. Watch one person do day
1 and day 3. Do not help. Everything below is a hypothesis until this exists.

**Listen to Absorb and Retrieve on a phone.** Open item 10, deferred three
times, with 36 scenes riding on it. Two minutes.

---

## Tier 1 — close the speaking loop (no new content)

### 1. ~~A timed formulation step~~ — built 2026-08-29

Between Retrieve and Speak, or as a card mode: Spanish prompt → 4–6 second
countdown → the learner **says** the English from memory → the model clip plays
→ self-compare. This is the classic zero-cost fluency intervention (4/3/2,
repeated retelling); gains are in speech rate and pausing, not accuracy, and
the studies are small — say so in the copy by not promising anything.

The prompts already exist: every chunk has `es` and `example_es`. This is a UI
change against content that is already authored, and it is the only thing in
the product that would train formulation at all. Untimed-scored, time-visible:
the clock is pressure, never a grade.

*Cost: ~1 day. Depends on: nothing.*

### 2. On-device speech recognition in Speak

**Researched 2026-08-29 (web).** Four facts change how this gets built:

- **Chrome's on-device Web Speech API is desktop-only.** Chrome 139 shipped
  `SpeechRecognition.available/install` and `processLocally`, which would have
  been free, private and zero-download — but MDN's compat data records
  `chrome_android: false` for all three, and the same for Samsung Internet,
  WebView, Firefox Android and Safari iOS. On the archetype's phone the only
  Web Speech API is the cloud one that ships audio to Google. Rejected stands.
- **Do not depend on WebGPU.** ~78% of Chrome Android users have it, but
  transformers.js has had Android-WebGPU corruption bugs, and on desktop its
  own benchmark thread found WASM *faster* than WebGPU for whisper-base. Build
  WASM-only, require SIMD, treat WebGPU as an accident if present.
- **Moonshine-tiny beats whisper-tiny on every axis that matters here.**
  27M params vs 39M; ~48% lower WER than whisper-tiny; ~5× faster on-device;
  **27.7 MB at int8** against whisper-tiny.en's 40.6 MB. The English weights
  and `@moonshine-ai/moonshine-js` are both MIT (the *Spanish* model carries a
  community licence — irrelevant, only English is recognised). ONNX exports
  exist at `onnx-community/moonshine-tiny-ONNX` for transformers.js.
- **Phone latency is the unverified thing.** whisper.cpp's own WASM demo says
  to use a desktop and quotes 2–3× *slower* than real time on a modern CPU;
  for a four-second utterance that is 8–12 s of waiting, which is too long.
  Moonshine's 5× claim would bring that to ~2 s. Nobody has measured this on a
  cheap Android, and that measurement is the whole spike.

**The build, revised.** Moonshine-tiny int8 via transformers.js on WASM,
matched against the **known target string** — constrained matching, never open
transcription, never a pronunciation score; only *"te escuchamos"* versus
*"una vez más"*. A verified match emits `produce_spoken`, which
`countsAsProduction` and the CHECK are already waiting for.

The 28 MB download is real money on the archetype's data plan: **opt-in,
offered once, on Wi-Fi if the Network Information API says so**, cached by the
service worker (#10) once it exists. Until the model is present the stage runs
exactly as it does today — self-report, no maturation.

**`tests/spoken-production.test.ts` must be updated deliberately.** It fails
the build if any file outside three named ones references `produce_spoken` —
that landmine exists precisely so a self-report never matures a card. Add the
recogniser's file to `ALLOWED` and extend the test to assert the emit is gated
on a verified match.

**The spike exists: `/spike/asr`** (built 2026-08-29, public, throwaway).
Open it on the cheapest Android you can borrow, tap *Load model*, tap *Record*,
say the target sentence, tap *Copy results*. It reports `wasmSimd`,
`deviceMemoryGB`, `downloadMB`, `loadMs`, `recogniseMs`, `realTimeFactor` and
whether the transcript matched. **Under ~3 s `recogniseMs` → build (2–3 days).
Over → park it and put the hours into #4.** Delete the route either way.

### 3. ~~Let him hear himself~~ — built 2026-08-29

`MediaRecorder` already captures the recording and uploads it to
`user-recordings`. **Nothing ever plays it back** — there is no
`createObjectURL` anywhere. Self-listening next to the model clip is one of the
few pronunciation interventions that works without a teacher, and it is
90% built.

*Cost: hours. Depends on: nothing.*

---

## Tier 2 — more English per day

### 4. ~~An extensive listening library~~ — mechanism built 2026-08-29; 12 tracks / 11.3 min so far, target is 10–20 min per unit

A new content type — `content/listening/<unit>.yaml` — of re-narrations,
monologues, second takes of the story from another character's view, all in the
**same cast and the closed word list already released**. No new vocabulary, so
the validator waves it through; same Piper pipeline; a fraction of a unit's
cost per minute. Target 10–20 minutes per unit, taking Block 1 from 17 minutes
of connected speech to 3–4 hours.

Surface it as *"más historias"* after Absorb, unscored, with the transcript. It
is the only item on this list that moves the 48-hour number, and by an order of
magnitude the best hours-per-authoring-hour available.

*Cost: schema + stage ~2 days; then ~1–2 hours of authoring per unit. Depends
on: nothing — but write it against Block 1 before writing Block 2.*

### 5. ~~Speech rate that varies, and a speed control~~ — built 2026-08-29

The rate gate homogenised the cast to a **1.10× spread**, which is *less*
variable than real speech — the project optimised toward the thing that hurts
perceptual robustness. Give each character a deliberate rate (Maria fast,
Ana slow) and ramp upward across blocks; loosen `MAX_SCENE_SPREAD` on purpose.
Separately, a `playbackRate` control (0.8× / 1× / 1.25×) on the scene player is
nearly free and is what Maria was *written* to be.

The honest limit: `length_scale` gives fast *citation* speech, not casual
speech — no reductions, no linking. That gap is real and TTS cannot close it.

*Cost: hours. Depends on: nothing.*

---

## Tier 3 — meaning without Spanish

### 6. ~~Images, narrowly~~ — built 2026-08-29: 53 Noto Emoji pictograms + 6 portraits, 34 chunks and all 8 frames pictured

**The taper has no terminus.** Every chunk's meaning is a Spanish string. At the
least-supported level Meet withdraws the gloss and replaces it with *nothing*,
and no unit authors `q_en`, so levels 3 and 5 are identical in Absorb. The
product built a mechanism to remove Spanish with nothing to remove it *to*. An
image is the only $0 third route to meaning that is neither Spanish nor an
English definition a beginner cannot read.

Be clear which claim is which. For the comparison that matters — picture versus
L1 translation for adult L2 form-meaning mapping — the evidence does **not**
favour pictures; expect roughly zero change in retention. What images buy is
disambiguation, decoupling from L1, and legitimacy: a wall of text reads as a
worksheet, and a nineteen-year-old who already thinks he is bad at English
does not open worksheets on day nine.

The limit: **the best content is exactly what cannot be pictured.** *"I don't
understand"*, *"Can you repeat that?"*, *"Give me a moment"* — the repair
chunks. Roughly 30–40% of A0 chunks are picturable, falling at A1+.

Scope, in order: **frame fillers first** (~30, a picture chooser makes
slot-filling non-translational and makes the frame visibly a machine), **six
cast portraits** (permanent voices, no faces), then concrete nouns. ~150–250
assets total. Pictograms, not photos — Mulberry (CC BY-SA), OpenMoji
(CC BY-SA); **ARASAAC is CC BY-NC-SA and the NC needs a decision**. Never
generated images of immigrants. Add the optional `image:` field to
`ChunkSchema`, frame fillers and `CharacterSchema` **now**, even empty —
retrofitting 850 chunks later costs an order of magnitude more. Hash-and-commit
like audio; every image is one more edge request, and requests bind before
bytes.

*Cost: schema ~hours; ~1 day of curation; portraits an afternoon. Depends on:
nothing.*

### 7. ~~English comprehension questions~~ — authored 2026-08-29, all 108

`q_en` / `options_en` on scene questions, so the upper taper levels do
something. Both halves of a question must come from one language — the code
already enforces that. Pure authoring.

*Cost: ~20 minutes per unit. Depends on: nothing.*

---

## Tier 4 — bridge to his actual day

### 8. ~~A phrasebook~~ — built 2026-08-29

`/frases`: every chunk he has met, grouped by situation (at the counter, at
work, lost, didn't understand), searchable, with audio. He is *surrounded by
English he cannot use* and his phrases only exist inside a lesson. Everything is
already authored, glossed and voiced; it is merely locked behind `current_unit`.
The highest value-to-hours ratio on this list.

Keep the repair strategies pinned at the top as a permanent deck — they convert
a failed conversation into a continued one, which is worth more than any
vocabulary set.

*Cost: ~1 day. Depends on: nothing.*

### 9. ~~Missions as the scoreboard~~ — built 2026-08-29 (the count; "one line to say today" is not)

Missions are the only component with real transfer and the least instrumented.
Accumulate them: *"Has hablado inglés con 7 personas"* on `/home` is a stronger
reason to return than a streak, and it reframes progress as the thing the
product claims to teach. The data model exists. Then make every session end
with *one line to say to a human today*.

*Cost: hours. Depends on: nothing.*

---

## Tier 5 — retention infrastructure

### 10. ~~PWA~~ — built 2026-08-29; PNG icons are a follow-up

No manifest, no service worker. Add-to-home-screen plus caching the current
unit's ~2.2 MB of Opus means it opens like an app, works on the bus, and costs
zero edge requests on day 2 — the constraint `DEPLOY.md` says binds first. The
archetype has a data plan, not wifi.

*Cost: ~1 day. Depends on: nothing.*

### 11. Web Push reminders

The exit criterion is 30 consecutive days and the product has no way to reach
someone who forgets. Free, no email needed. Lower priority than everything
above because a reminder to an unvalidated loop is a reminder to churn.

*Cost: ~1 day. Depends on: a real learner having come back once on their own.*

---

## Tier 6 — pronunciation

### 12. Word stress as a drill

Tap the stressed syllable on TTS audio. Misplaced lexical stress costs more
intelligibility than most segmental errors, it is high functional load, and
**stress survives synthesis** — so this is the one pronunciation item that
needs none of the 2,700 human recordings. It also has no exercise shape in the
product today: `stress_intonation` sits in the contrast enum and, like
`final_clusters`, is not a minimal-pair contrast at all.

*Cost: ~2 days plus stress marking in content. Depends on: nothing.*

### 13. HVPT — one contrast, roster fixed first

The mechanism is right and the spec is mis-sized. Talker count is not the
binding parameter; **dose** is (~15–20 sessions of a few hundred trials). Six
talkers is canonical. So: fix the enum first (add `ae_eh`, demote `th`, split
out the two non-minimal-pair items), then do **one** contrast — 300 clips, one
weekend of volunteers or Lingua Libre — and drill it properly before authoring
a second. Treat 2,700 as a number nobody will reach.

*Cost: enum migration ~hours; recordings blocked on six humans.*

---

## Two fixes that are not features

- **`readability.ts` counts proper nouns free in the numerator and leaves them
  in the denominator.** One scene is ~20% names; the score is inflated by
  exactly that. Exclude them from `total`. Block 1 scores 100% anyway, so this
  changes no verdict today and every verdict later.
- **The 95% rule is a no-unexplained-words rule, not a comprehensibility
  threshold.** The 95/98% literature measures unassisted reading; Absorb is
  assisted listening with the transcript on screen. Keep the rule — it is sound
  authoring discipline — but stop citing it as evidence of comprehension.

---

## What not to build

Branching dialogue (correctly deferred). The placement test. More
achievements. Social features or leaderboards — they add shame and contradict
the entire stance. Illustrated scenes. Pronunciation scoring of any kind.
**Blocks 2–4, before a learner has finished Block 1 twice** — 18 units on a
loop nobody has completed is the highest-variance way to spend the next year.

## The sequence

Learner test → Tier 1 (1, 3, then 2) → Tier 2 item 4 against Block 1 →
phrasebook → images → PWA → the rest as the learner's failures dictate.


---

# v2 — the second review (2026-08-31)

Five members, blind peer review, every load-bearing claim re-measured against
the repo by the reviewers. Aggregate ranking of the members:
rigorist > red-teamer > generalist > pragmatist > first-principles.

## What did not survive scrutiny — including things built last week

- **The headline promise is unfalsifiable.** The landing page says *"Hablas
  desde la primera sesión"* and nothing in the product can tell whether the
  learner ever opened his mouth. He can tap silently through 36 sessions and
  be congratulated.
- **The taper's middle option was a placebo.** `l1Support` made levels 1 and 3
  behaviourally identical while `/ajustes` offered exactly 1/3/5 — and the
  copy for the middle option promised English questions it did not deliver.
- **The missions scoreboard was a tap count.** No unique constraint on
  `(user_id, mission_id)`, so re-filing a mission incremented *"Has hablado
  inglés con N personas"* — a number `/home` presents as a fact about the
  world.
- **The formulation warm-up dealt different prompts every session.** Seeded on
  the session id. De Jong & Perfetti (2011): both same-topic and new-topic
  4/3/2 groups improve during training; **only the same-content repeaters keep
  the gain at posttest**. The active ingredient is repetition of the same
  material, and the warm-up shipped the variant that does not stick.
- **The input dose is 44.3 minutes of unique English for the whole block** —
  ~74 seconds a day. The listening library is at 2.07 min/unit against its own
  10–20 target.
- **The speaking partner is typography.** `ClipKind` has no dialogue kind; in
  the one stage where the learner rehearses a real exchange, Maria's question
  is silent text and he reads his answer off the screen.
- **Onboarding promises** *"Así elegimos las conversaciones que vas a
  practicar"* and nothing reads `motivation`.
- **The recording review plays only his own take** — self-comparison against a
  model is the intervention; playback alone is not.
- **The shadowing pass shows the text through all three stages**, against the
  documented protocol (script off for the shadow pass).
- **~45% of `public/audio` (798 files) is served to nobody** — stitching
  intermediates plus 154 example clips with no consumer.
- Stale comments: two files still said "no unit has `q_en`" after 108 English
  questions were authored.

## Evidence corrections to this file's own v1

- **HVPT: two talkers are enough at this level.** The 2025 meta-analysis finds
  talker count has *no* significant effect for lower-proficiency learners, and
  the closest analogue (five-vowel L1, /i/–/ɪ/) found a single-talker group
  learned *more*. Blocked-by-talker beats interleaved for low-aptitude
  learners. So: **two talkers × 25 pairs = 100 clips = one afternoon**, which
  is also the only thing `publish-check` still fails on. Before recording:
  add a **duration-matching validator rule** — Spanish listeners cue /i/–/ɪ/
  on length alone, so an unmatched drill can be passed on duration while
  teaching nothing spectral. And note the probe-hash guard proves *bytes*
  differ, not that a human hears two voices (perceived-similarity is what
  matters, and only ears can check it).
- **ASR (#2): constrained matching does not need an open-vocabulary model.**
  Matching against a known target is keyword spotting, and KWS models run an
  order of magnitude smaller than Moonshine's 28 MB. If the phone spike is
  slow, try a KWS model before parking the feature.
- **Word stress over segmentals:** prosodic training transfers to spontaneous
  speech; segmental training improves read-aloud only. Raises #12, cuts
  against spending the recording budget on segmental contrasts.
- **The 95% rule should stop citing reading research**: listening's measured
  threshold is lower (90–95%), and Absorb is assisted. Keep the rule as
  authoring discipline; drop the borrowed justification.

## v2 order

| # | Item | Cost | Status |
|---|---|---|---|
| 0 | **One learner, two weeks.** v1 opened with this; 29 commits of features followed. That is the pattern to break. | two coffees | **open** |
| 1 | Formulation warm-up repeats the *same* hand (3 rounds in-session, held ~3 sessions) | ~2 h | **done 2026-08-31** |
| 2 | Model clip beside his take on the recording review | ~1 h | **done 2026-08-31** |
| 3 | Voice the speaking partner (`speak_line` clips); withhold his line until he answers | ~½ day | **done 2026-08-31** |
| 4 | Integrity: taper middle level real, missions counter unique, `motivation` copy honest, stale comments | ~½ day | **done 2026-08-31** |
| 5 | Ear training: 2 talkers, 100 clips, duration-matching rule first | one afternoon + 2 humans | |
| 6 | Listening library to target (10–20 min/unit) | 1–2 h/unit | |
| 7 | Dictation review mode (audio → type; grader exists) | ~1 day | |
| 8 | Hide shadow-pass text | ~1 h | |
| 9 | `/cognados` — teach the cognate rules the scorer already credits | ~½ day | |
| 10 | Receptive deck: ~60 things said *to* him (*"Cash or card?"*) | authoring | |
| 11 | Word-stress drill | ~2 days | |
| 12 | ASR, gated on the spike; try KWS if Moonshine is slow | 2–3 days | |

**Steals confirmed by research:** VOA Learning English (verified public
domain, commercial reuse w/ attribution) as a third `/escuchar` shelf; We
Speak NYC's lesson-one clarification set (add `How do you spell {NP}?` and
`What does {NP} mean?` — both frames); CASAS competencies to drive Blocks 2–4
can-dos; a question posed *before* the scene; USA Learns' unscored self-check
at unit end; a 3-minute session path; a pausable timer instead of skip-only.

**Still refused:** leagues, hearts, pronunciation scores, runtime AI partner,
community corrections, deleting typed Retrieve (only writer that can satisfy
the mastery CHECK), Blocks 2–4 before a learner finishes Block 1 twice.
