# What to build next, and why

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

### 1. A timed formulation step

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

Whisper-tiny or -base through `transformers.js` on WASM/WebGPU: ~40–75 MB,
cached once, no API key, no server inference. Genuinely $0 **and genuinely
private** — the Web Speech API is also free and was rejected because Chrome
round-trips audio to Google, which for this learner is disqualifying at any
price.

Match against the **known target string**, never open transcription: far more
forgiving and far more accurate. Never a pronunciation score, never a pass
mark — only *"te escuchamos"* versus *"una vez más"*. A verified match emits
`produce_spoken`, which `countsAsProduction` and the `learned_requires_production`
CHECK are already waiting for.

**`tests/spoken-production.test.ts` must be updated deliberately.** It fails
the build if any file outside three named ones references `produce_spoken` —
that landmine exists precisely so a self-report never matures a card. Add the
recogniser's file to `ALLOWED` and extend the test to assert the emit is gated
on a verified match. Opt-in, with a plain-Spanish consent line.

*Cost: 2–4 days. Depends on: checking Android Chrome WASM support on a cheap
phone first.*

### 3. Let him hear himself

`MediaRecorder` already captures the recording and uploads it to
`user-recordings`. **Nothing ever plays it back** — there is no
`createObjectURL` anywhere. Self-listening next to the model clip is one of the
few pronunciation interventions that works without a teacher, and it is
90% built.

*Cost: hours. Depends on: nothing.*

---

## Tier 2 — more English per day

### 4. An extensive listening library

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

### 5. Speech rate that varies, and a speed control

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

### 6. Images, narrowly

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

### 7. English comprehension questions

`q_en` / `options_en` on scene questions, so the upper taper levels do
something. Both halves of a question must come from one language — the code
already enforces that. Pure authoring.

*Cost: ~20 minutes per unit. Depends on: nothing.*

---

## Tier 4 — bridge to his actual day

### 8. A phrasebook

`/frases`: every chunk he has met, grouped by situation (at the counter, at
work, lost, didn't understand), searchable, with audio. He is *surrounded by
English he cannot use* and his phrases only exist inside a lesson. Everything is
already authored, glossed and voiced; it is merely locked behind `current_unit`.
The highest value-to-hours ratio on this list.

Keep the repair strategies pinned at the top as a permanent deck — they convert
a failed conversation into a continued one, which is worth more than any
vocabulary set.

*Cost: ~1 day. Depends on: nothing.*

### 9. Missions as the scoreboard

Missions are the only component with real transfer and the least instrumented.
Accumulate them: *"Has hablado inglés con 7 personas"* on `/home` is a stronger
reason to return than a streak, and it reframes progress as the thing the
product claims to teach. The data model exists. Then make every session end
with *one line to say to a human today*.

*Cost: hours. Depends on: nothing.*

---

## Tier 5 — retention infrastructure

### 10. PWA

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
