# Where the project is

**Last updated:** 2026-08-28 · **Read this before touching anything.**

Hablar — self-paced English for Spanish-speaking beginners, per the PRD (v2.1).
Four build sessions done. This file exists so the next one does not have to
re-derive what was decided or rediscover what bit us.

Read it alongside, not instead of:

| File | What it covers |
|---|---|
| `AGENTS.md` | this is Next 16 — read `node_modules/next/dist/docs/` before writing app code |
| `docs/DEPLOY.md` | env vars, audio hosting, auth URLs — read before any deploy |
| `content/README.md` | the authoring pipeline, the 95% rule, the two kinds of audio |
| `supabase/README.md` | schema, RLS, the connection layer |
| `lib/copy/es.ts` | every Spanish string, with the house style at the top |

---

## Start here

Committed as `2d58679 first` — 86 files, everything through F1. Verified: no
`.env.local` in history, only `.env.example` is tracked.

```bash
npm run dev            # needs .env.local, already present locally
npm test               # 66 tests, ~4s (hits the live database — see below)
npm run content:validate
```

`public/audio/` **is** tracked as of 2026-08-27 (214 files, 2.7 MB). It cannot
be built on Vercel — `say` is macOS-only — so the repo is the only thing that
carries sound to production. See `docs/DEPLOY.md`.

---

## Live infrastructure

Supabase project **`esl`** — ref `sqjjikmwxnfeuzzxqnmk`, us-east-2, Postgres 17.6.
Linked. Six migrations applied. Content seeded. Auth config pushed.

| Table | Rows |
|---|---|
| blocks / characters / speakers | 6 / 6 / 6 |
| units / chunks / scenes | 1 / 25 / 6 |
| contrast_sets / minimal_pairs | 1 / 25 |

`.env.local` exists and works. It is gitignored; `.env.example` documents it.

**Deployed at <https://esl-psi.vercel.app>.** `site_url` and the auth redirect
allow-list point there as of 2026-08-27 (`npx supabase config push`, verified
`auth: up_to_date`); `config.toml` is the source of truth, so never edit those
values in the dashboard. `docs/DEPLOY.md` covers the rest.

---

## What is built

**Content pipeline (F9)** — complete, and it is the part with the most thought in
it. YAML → schema validation → local TTS → `audio-manifest.json` → Supabase.
`b1_u1` fully authored: 25 chunks, 6 scenes, one continuous story. 214 Opus
files, 2.7 MB, 2.3 MB for the unit against an 8 MB budget.

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

**All five stages, progression, F8, F6 and F11 are done.** The daily loop is
complete, it no longer dead-ends, and it has a reason to come back tomorrow.

A one-off welcome modal lived in the root layout for a day and was removed on
2026-08-28, having served its purpose. One thing it taught is worth keeping:
**anything meant for a signed-in learner cannot be mounted on `/`**, because
`app/page.tsx` redirects a session-holder to `/home` before that page renders.
The root layout is the only place that reaches every entry state. Some browsers
still hold a stale `hablar:welcome-seen` key in `localStorage`; nothing reads it.

**Tests — 214, all passing.**

| Suite | n | Needs network |
|---|---|---|
| `content.test.ts` | 23 | no |
| `audio-plan.test.ts` | 24 | no |
| `session-stages.test.ts` | 25 | no |
| `quiz.test.ts` | 9 | no |
| `drill.test.ts` | 12 | no |
| `progress.test.ts` | 11 | no |
| `quests.test.ts` | 12 | no |
| `achievements.test.ts` | 7 | no |
| `error-patterns.test.ts` | 15 | no |
| `shadowing.test.ts` | 8 | no |
| `grade.test.ts` | 12 | no |
| `transcript.test.ts` | 5 | no |
| `no-paid-apis.test.ts` | 4 | no |
| `rls.test.ts` | 9 | **yes** |
| `onboarding.test.ts` | 6 | **yes** |
| `session.test.ts` | 18 | **yes** |

The last three create and delete real users. They run whenever `.env.local` has
`RLS_TEST_ENABLED=1`, which is why `npm test` takes ~6s instead of 0.2s. **Never
point them at production.**

---

## Decisions that depart from the PRD

Each of these looks like a bug if you only read the PRD. They are not. If one
turns out to be wrong, change it deliberately — do not "fix" it back.

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

**A known transfer error is never forgiven as a typo.** `gradeTypedAnswer` has
a generous typo budget, and "Am fine, thank you" is one character from "I'm
fine, thank you" — so it sailed through as a near-miss *and counted toward
mastery*, which would have let a learner reach `learned` while dropping the
subject pronoun every single time. Now a match against `ERROR_PATTERNS` forces
`wrong` before the edit-distance check runs. Found by typing it into a browser
on 2026-08-28; no test would have caught it, because the rule it broke had not
been thought of yet.

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

1. ~~Commit everything.~~ Done — `b267c88`.
2. **Look at F1 in a browser.** Verified: routing, data, markup. Not verified:
   whether it *feels* right. Walk `/` → `/signup` → onboarding in a narrow
   window. The test is the PRD's: would a nervous 19-year-old quit at this
   screen?
3. **Native-speaker review of `lib/copy/es.ts`** — ~120 lines, an explicit F1
   acceptance criterion, and not something to sign off alone.
4. **The TTS engine is undecided.** `provider: macos` is what the committed
   audio used; the PRD prescribes Piper (§8.1A) and makes it a week-1 listening
   test. `npm run content:spike` renders the same 20 lines through every
   installed engine. Piper needs `pip install piper-tts`. **Decide before
   authoring Block 2** — the answer changes 214 files, and later, thousands.
5. **No ear-training audio exists.** 0 of 300 recordings for `ee_ih`. Six people
   × 50 words ≈ a weekend of favours. `npm run content:recording-kit --
   --contrast=ee_ih` writes each of them a script. Until then Stage 1 of the
   daily loop has nothing to play and `npm run content:publish-check` fails —
   correctly. The session player already skips the stage cleanly, so this
   blocks nothing except the stage itself.
6. ~~`public/audio/` is gitignored.~~ Resolved 2026-08-27: committed and served
   from Vercel's CDN with immutable cache headers, per §8.1C. Full curriculum
   projects to ~110 MB against 100 GB/month of Hobby bandwidth — roughly 900
   learners downloading everything, once, per month. Rationale, the rejected
   alternatives and the headroom maths are in `docs/DEPLOY.md`.
7. **Content: 1 unit of 36.** Block 1 needs 6. The PRD is blunt that authoring
   is ~70% of total effort — budget it honestly.
8. **Email verification flow** — see the confirm-later decision above.
9. **Listen to the audio — partly done.** Confirmed by ear on 2026-08-28:
   **Meet plays, and its four voices are audibly distinct.** That is worth more
   than it looks — it is live confirmation that the macOS `say` voice-collision
   trap (see traps) is not recurring, i.e. the pipeline's probe-hash guard holds
   all the way through to the browser.

   Still unheard, because the automation harness cannot load media at all:
   **Absorb** (does the scene play, does the highlight track the line, does
   tapping a line seek to the right sentence) and **Retrieve** (does the card
   clip play when the answer is revealed). Both are a couple of minutes in a
   real browser.
10. ~~`speaking_task` is authored but never seeded.~~ Resolved 2026-08-28: the
    unit's speaking task now seeds into `dialogues` and the stage is live. The
    task gained a `character` field, because `dialogues.character_id` is a
    not-null foreign key and an anonymous partner would be the one voice in the
    product belonging to nobody.
11. ~~`ts-fsrs` is in `devDependencies`.~~ Moved to `dependencies` 2026-08-28.
12. **Speaking-task lines have no audio.** The audio pipeline covers chunks,
    examples and scene lines, but not the `speaking_task` script, so the AI half
    of a conversation is read rather than heard. Adding it means extending
    `buildAudioPlan` and regenerating — worth doing with the TTS engine decision
    (item 4), not before.

### What is left, and why

Everything buildable without new content or new decisions is built. The three
features still designed-but-unbuilt are all blocked on authoring, not on code:

| Feature | Blocked on |
|---|---|
| **F12 missions** (`missions`, `mission_reports`) | No missions authored, and no YAML schema for them. The tables and the "a failed mission awards full XP" rule are ready. |
| **Branching dialogue** (`dialogue_runs`) | `dialogues.nodes` holds a flat script; `guided` and `open_response` modes need authored node trees. |
| **The visible L1 taper** | The mechanism is wired (`l1SupportForBlock`, `shouldOfferMoreSupport`, written on unit advance) but its effect needs content that does not exist: English variants of the scene questions, and an English chrome for `lib/copy/es.ts` at level 5. |

`error_events` is written but never *read* — the "these are your patterns"
screen is not built, and it is the natural next thing once there is enough data
to be worth showing.

### Next feature

The daily loop is complete: all five stages are built and one learner can walk
`/home` → Meet → Absorb → Retrieve → Speak → `/home` end to end. Ear is built
and skipped until its recordings exist.

What Phase 1 still needs, roughly in order of what blocks the exit criterion:

1. **Hear the audio.** Nothing in any stage has been listened to (open item 9).
   Cheapest and highest-value thing on this list.
2. **Content: 1 unit of 36.** The loop works and runs out after a few days —
   Block 1 needs 6 units. Decide the TTS engine first (open item 4); the answer
   changes every file authored after it.
3. **Ear-training recordings** (open item 5). Six people, fifty words each. The
   stage is already written and will turn itself on.
4. ~~**F8**~~ — done 2026-08-28. Verified end to end in a browser: a full
   session moved XP 210 → 265 (4 stages × 10 + speaking × 15) and turned all
   three quests to *Listo*. **Achievements are still unbuilt** — the
   `achievements` table has no writer, and no achievement keys are defined.
5. ~~**Unit progression.**~~ Done 2026-08-28. Verified end to end against a
   throwaway second unit, and the end-of-curriculum state verified in a browser
   with a learner who had finished everything: Meet drops out, the session runs
   three stages, and `/home` explains itself.

The seam for a new stage body is `SessionPlayer` in
`app/session/[unitId]/session-player.tsx`.

**Exit criterion for Phase 1:** 30 consecutive days of Block 1 with no dead end,
and $0 runtime cost confirmed in the network tab.

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
