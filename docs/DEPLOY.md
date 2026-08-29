# Deploying

**Last updated:** 2026-08-27 · Host: <https://esl-psi.vercel.app> · Data: Supabase project `esl`

Read `STATE.md` first for where the project is. This file is only about getting
it onto the internet, and about the three things that have already gone wrong
doing that.

---

## Environment variables

Exactly two, and the app will not serve a single request without them.

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **yes** | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | **yes** | or `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `lib/supabase/env.ts` accepts either name |
| `SUPABASE_SERVICE_ROLE_KEY` | **no** | never set this on Vercel — see below |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | no | only with the OAuth client configured (`.env.example`) |
| `RLS_TEST_ENABLED` | **no** | test-only; it creates and deletes real users |

**Do not put the secret key on the web host.** It bypasses row-level security
entirely, and nothing the app serves needs it: `lib/supabase/admin.ts` is
imported only by `scripts/seed-content.ts` and `tests/no-paid-apis.test.ts`,
both of which run on a developer machine. Seeding is a local operation against
the linked project — the deploy never writes content.

### The failure this produces, and why it is confusing

Missing variables **do not fail the build.** Every route in this app is dynamic,
so nothing is prerendered, so nothing evaluates the config at build time. The
build goes green, the deployment goes live, and then every single route returns
**500**. Reproduced deliberately:

```
$ mv .env.local /tmp/ && npm run build     # ✓ Compiled successfully
$ npm start
  / -> 500   /login -> 500   /signup -> 500   /home -> 500
  ⨯ Error: Missing Supabase configuration: set NEXT_PUBLIC_SUPABASE_URL.
```

**`NEXT_PUBLIC_*` values are inlined at build time**, by literal text match (see
the comment at the top of `lib/supabase/env.ts`). Adding them in the Vercel
dashboard therefore changes nothing until you **redeploy**. Setting them and
reloading the page is the obvious move and it does not work.

---

## Audio

### The decision: commit it, serve it from Vercel's CDN

This is PRD §8.1C, and it is also the cheapest option that exists.

`public/audio/` **must be committed.** It was gitignored until 2026-08-27,
which meant a deploy shipped a language product with no sound. It cannot be
generated during a Vercel build — the current provider is macOS `say`, and
Vercel does not run macOS — so whatever is in the repo is exactly what learners
hear, and nothing else is.

Regenerate locally and commit the result:

```bash
npm run content:audio        # idempotent, content-hashed — a no-op if nothing changed
git add public/audio
```

### Why not somewhere else

| Option | Cost | Verdict |
|---|---|---|
| **Vercel static (`public/`)** | $0 within Hobby | **chosen** — no new service, no new hostname, no account to keep alive |
| Supabase Storage | free tier is 5 GB egress/month | rejected in PRD §8.1C: Storage egress binds long before anything else |
| Cloudflare R2 | $0 egress, 10 GB free | the escape hatch, not needed yet — see the headroom below |
| GitHub raw / jsDelivr | $0 | not a hosting product; do not build on it |

### Headroom

| | |
|---|---|
| Block 1 today (6 units + 12 listening tracks) | **22 MB, 1,463 files** |
| Scripted audio at 24 units | ~75 MB, ~5,850 files |
| Ear training, all 9 contrasts | ~13 MB, 2,700 files (9 × 25 pairs × 2 words × 6 speakers) |
| **Full curriculum** | **~88 MB** |

The 24-unit row is now extrapolation from six real units rather than from one:
Block 1 averages **3.1 MB and ~240 files per unit** with two listening tracks
each, and the projection is that × 24. The listening library is meant to grow
to 10–20 minutes a unit, so treat it as a floor.

**Bandwidth is not the meter that binds.** ~77 MB against Vercel Hobby's
100 GB/month is ~1,300 learners each pulling the whole curriculum once — which
looks like enormous headroom and is the wrong number to plan against. The
curriculum is ~5,150 *files*, and each one is an edge request. Against Hobby's
request allowance, the ceiling is on the order of **a couple of hundred
learners**, not thirteen hundred — roughly 6× lower, and it is the limit that
trips first.

Check the current Hobby quotas before relying on either figure; both have moved
before. The direction is what matters: **count requests, not megabytes.** A
learner who works through one unit pulls ~215 files — measured, now that six
exist — so a real month of real use is far below a full-curriculum download
either way.

At one learner this is not a rounding error, it is free. Revisit when this
carries tens of daily learners, and the answer then is R2 — zero egress fees
and request limits that are not the binding constraint — with
`audio-manifest.json` rewritten to absolute URLs. Nothing in the app reads
audio paths directly; they all come from the manifest, which is what makes that
a one-file change.

### Cache headers are not optional here

`next.config.ts` sets, for `/audio/:path*.opus`:

```
Cache-Control: public, max-age=31536000, immutable
Content-Type:  audio/ogg; codecs=opus
```

Both are load-bearing.

**`immutable`** is safe *because filenames are content hashes* — editing a line
of content produces a new hash and a new file, so a given name's bytes can
never change. Without it, Next serves everything in `public/` as
`Cache-Control: public, max-age=0` (it cannot know the names are hashes), and
every clip is revalidated on every play: a round trip per tap, on the slowest
connection this product is designed for, for bytes the browser already has.

**`Content-Type`** because Next otherwise serves `.opus` as
`application/octet-stream`, and some browsers refuse to decode an `<audio>`
source they were not told is audio.

Verify after any deploy:

```bash
curl -sI https://<host>/audio/chunk/<hash>.opus | grep -i 'cache-control\|content-type'
```

---

## Supabase auth URLs

**Done 2026-08-27** — pushed and verified in sync (`auth: up_to_date`).
`supabase/config.toml` now reads:

```toml
site_url = "https://esl-psi.vercel.app"
additional_redirect_urls = [
  "https://esl-psi.vercel.app/auth/callback",
  "http://localhost:3000/auth/callback",      # dev still needs both
  "http://127.0.0.1:3000/auth/callback",
]
```

`site_url` is what Supabase uses to **build the links it puts in emails**, and
it is the allow-list root for post-auth redirects. Pointed at a laptop — which
it was until now — every password-reset link a learner receives from the live
site opens nothing.

It was not yet breaking anything, and it is worth knowing why, because the same
reasoning says when it will: email confirmation is off (see STATE.md), and
signup and login are email + password returning a session directly, so nothing
currently round-trips through Supabase's redirect machinery. It becomes
load-bearing the moment either of these lands:

- password reset / email verification (STATE.md open item 8);
- Google OAuth, which exchanges its code at `/auth/callback`.

`config.toml` is the source of truth. Change it there and push — never edit the
values in the dashboard, or the next push silently reverts them:

```bash
npx supabase config push          # prints a diff, then applies it
```

No Vercel preview wildcard is configured. Supabase accepts
`https://*-<scope>.vercel.app/auth/callback` if you ever need previews to
complete an OAuth round trip, but every extra entry is one more place a
redirect can be aimed — do not add it speculatively.

---

## Checklist

1. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set in Vercel → **redeploy**
2. `public/audio/` committed and present in the deployed tree
3. ~~`site_url` and `additional_redirect_urls`~~ — done; re-run `npx supabase config push` after any `config.toml` change
4. `curl -sI https://<host>/audio/chunk/<hash>.opus` → 200, `immutable`, `audio/ogg`
5. Landing page loads signed out; signup → onboarding → `/home` → session player walks
6. Network tab shows **no third-party requests and no per-request API cost** — PRD's $0 runtime claim, checked rather than assumed
