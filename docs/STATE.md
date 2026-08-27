# Where the project is

**Last updated:** 2026-08-27 · **Read this before touching anything.**

Hablar — self-paced English for Spanish-speaking beginners, per the PRD (v2.1).
Three build sessions done. This file exists so the next one does not have to
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
Linked. Five migrations applied. Content seeded. Auth config pushed.

| Table | Rows |
|---|---|
| blocks / characters / speakers | 6 / 6 / 6 |
| units / chunks / scenes | 1 / 25 / 6 |
| contrast_sets / minimal_pairs | 1 / 25 |

`.env.local` exists and works. It is gitignored; `.env.example` documents it.

**Before deploying anywhere:** `site_url` on the hosted project is still
`http://127.0.0.1:3000`. It breaks nothing *today* — email confirmation is off
and signup returns a session directly, so nothing round-trips through
Supabase's redirects — but it is a landmine under password reset (open item 8)
and Google OAuth. `docs/DEPLOY.md` has the values and the push command.

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

The stage bodies are the next five pieces of work; see **Next feature**.

**Welcome note** — a one-off personal message to the learner, in the root
layout (`app/welcome-note.tsx`), dismissed once and remembered in
`localStorage` under `hablar:welcome-seen`. In the *layout* and not on the
landing page for a reason worth not rediscovering: `app/page.tsx` redirects a
signed-in visitor to `/home` before `/` renders, so mounting it there means the
one person it is addressed to never sees it. The copy is `es.welcome` and is
marked in `lib/copy/es.ts` as not-for-review — it is the author's own words, not
product copy.

**Tests — 92, all passing.**

| Suite | n | Needs network |
|---|---|---|
| `content.test.ts` | 23 | no |
| `audio-plan.test.ts` | 24 | no |
| `session-stages.test.ts` | 21 | no |
| `no-paid-apis.test.ts` | 4 | no |
| `rls.test.ts` | 9 | **yes** |
| `onboarding.test.ts` | 6 | **yes** |
| `session.test.ts` | 5 | **yes** |

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
9. **`speaking_task` is authored but never seeded.** `content/units/b1_u1.yaml`
   has a full scripted task; `UnitSchema` validates it; `scripts/seed-content.ts`
   does not write it to any table. `dialogues` is the table it belongs in. Until
   it is seeded the `speak` stage has no source and is skipped. Fix this as part
   of building Speak, not before.
10. **`ts-fsrs` is in `devDependencies`.** The retrieve stage imports it at
    runtime. Move it to `dependencies` before F2, or the first Vercel build
    breaks in a way that looks like a Next problem.

### Next feature

The shell walks; the stages are empty. Fill them in this order — each is a
self-contained slice that leaves the loop working:

1. **Meet** — new chunks with audio from `audio-manifest.json`; gloss reveals
   increment `user_cards.gloss_reveals`.
2. **Absorb** — scene playback plus the three authored multiple-choice
   questions; tapping a transcript line replays that line (§F4 needs the
   sentence timings already in `scenes.transcript`).
3. **Retrieve** — F2 proper. FSRS via `ts-fsrs` (see open item 10),
   `recognize` / `produce_typed` modes, `produce_passes` climbing toward the
   `learned_requires_production` constraint.
4. **Speak** — scripted mode, MediaRecorder into the `user-recordings` bucket,
   `speaking_tasks_completed`. Needs open item 9 first.
5. **Ear** — last, once the recordings from open item 5 exist.

Then F3/F5/F11. The seam for each is `SessionPlayer` in
`app/session/[unitId]/session-player.tsx`: replace the placeholder section with
the stage body, keep the advance button.

XP and the three daily quests are deliberately absent — they belong to F8.
Completing a session already credits `days_practiced` and the soft consecutive
counter, because `/home` displays them.

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
