# Where the project is

**Last updated:** 2026-08-26 · **Read this before touching anything.**

Hablar — self-paced English for Spanish-speaking beginners, per the PRD (v2.1).
Two build sessions done. This file exists so the next one does not have to
re-derive what was decided or rediscover what bit us.

Read it alongside, not instead of:

| File | What it covers |
|---|---|
| `AGENTS.md` | this is Next 16 — read `node_modules/next/dist/docs/` before writing app code |
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

Note `public/audio/` is **not** tracked (214 files, 2.7 MB) — see open item 6,
because it means a deploy currently ships with no audio.

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

**Before deploying anywhere:** `site_url` on the hosted project is
`http://127.0.0.1:3000`. Password-reset and OAuth links are built from it, so
they currently point at a laptop.

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

**Tests — 66, all passing.**

| Suite | n | Needs network |
|---|---|---|
| `content.test.ts` | 23 | no |
| `audio-plan.test.ts` | 24 | no |
| `no-paid-apis.test.ts` | 4 | no |
| `rls.test.ts` | 9 | **yes** |
| `onboarding.test.ts` | 6 | **yes** |

The last two create and delete real users. They run whenever `.env.local` has
`RLS_TEST_ENABLED=1`, which is why `npm test` takes 4s instead of 0.2s. **Never
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

**`getUser()`, never `getSession()`,** in anything gating access. A session read
from a cookie is client-supplied data.

---

## Open, roughly in order

1. **Commit everything.** See the top of this file.
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
   correctly.
6. **`public/audio/` is gitignored, so a deploy ships with no audio.** §8.1C
   says commit it and serve from the CDN. Held off while the engine is
   undecided; the build cannot generate it on Vercel (`say` is macOS-only).
   **Resolve before any deploy.**
7. **Content: 1 unit of 36.** Block 1 needs 6. The PRD is blunt that authoring
   is ~70% of total effort — budget it honestly.
8. **Email verification flow** — see the confirm-later decision above.

### Next feature

Phase 1's walking skeleton, in PRD order: the session player (§4.2, five stages,
linear, resumable), then F2 SRS with production-mode cards, then F3/F5/F11.
`/home` currently has a disabled "Empezar" button and says so plainly — that is
the seam.

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
