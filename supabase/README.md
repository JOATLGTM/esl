# Database

Postgres, auth, and private storage. The schema is `migrations/`, applied by the
Supabase CLI. Nothing is created by hand in the dashboard — if it is not in a
migration, it does not exist.

## Status

Linked to project `esl` (`sqjjikmwxnfeuzzxqnmk`, us-east-2, Postgres 17.6). All
migrations are applied, content is seeded, and both live suites pass against it:
`npm run test:rls` (nine checks) and `tests/onboarding.test.ts` (six).

Auth config has been pushed (`npx supabase config push`), which turned email
confirmation off — the confirm-later decision, reasoned about in `config.toml`
at the flag itself.

**Before deploying anywhere, fix `site_url`.** The push set it to
`http://127.0.0.1:3000`, which is correct for local development and wrong the
moment there is a real origin: password-reset and OAuth links are built from it,
so they would point at the developer's laptop.

## Setup

You need a project. Either works; the free tier is enough for a long time.

**A hosted project** (what deploys):

```bash
npx supabase login
npx supabase link --project-ref <ref>     # dashboard URL: /project/<ref>
npm run db:push                           # apply every migration
cp .env.example .env.local                # then fill in from Settings > API
npm run content:seed                      # load the curriculum
```

**A local stack** (needs Docker):

```bash
npx supabase start                        # prints the local URL and keys
npm run db:reset                          # apply migrations to a clean database
npm run content:seed
```

Then `npm run dev`.

## The rule this schema is built around

**Row-level security is on for every table, before there is a row to leak**
(PRD Appendix A). Two shapes, and only two:

| | Read | Write |
|---|---|---|
| Content — units, chunks, scenes, pairs, dialogues, missions | anyone, signed in or not | nobody |
| Learner data — cards, sessions, recordings, errors | its owner | its owner |

Content is public-read because the landing page shows a real sample lesson
before signup, and because there is nothing private in a curriculum. It has **no
write policy at all** — with RLS on and no permissive policy, every write is
denied, including from a leaked publishable key. The seed script writes with the
service role, which bypasses RLS and never leaves a terminal.

Every learner policy is written as `(select auth.uid()) = user_id`. The subquery
form is evaluated once per statement instead of once per row, which is the
difference between a review queue that loads instantly and one that scans.

Note that learner tables deliberately do **not** use `force row level security`.
It looks like the stricter choice and is a trap here: FORCE subjects the table
owner to its own policies, buys nothing (the service role has `BYPASSRLS` and
bypasses FORCE anyway), and breaks signup — the `security definer` trigger that
creates a profile row would be checked against a table that has no insert policy
by design. The migration says so at the point where someone would add it.

`npm run test:rls` proves it: two real users, one writes, the other asks for the
rows and gets nothing. Reading policies is not evidence — a policy can be
perfect and attached to the wrong table.

## Things worth knowing before editing

**Profiles are created by a trigger, not by the client.** `users` has no insert
policy, because one would open a window where a request could claim a uuid that
is not its own. `handle_new_user()` is `security definer` with `set search_path
= ''`, which is not decoration: without a pinned search path, anyone who can
create a schema can shadow `public.users` and have that function write to their
table with elevated rights.

**`learned` is a database constraint, not a convention.** PRD F2 says a card
cannot reach `learned` until it has passed twice in a production mode.
`user_cards` carries `check (state <> 'learned' or produce_passes >= 2)`, so the
rule holds no matter which code path is updating the card. This is the single
most load-bearing pedagogical rule in the product; it does not belong in a
service layer.

**There is no `ease` column.** The scheduler is FSRS (`ts-fsrs`), which models
memory as stability plus difficulty. SM-2's ease factor has no equivalent, and
the PRD's field list predates the choice of scheduler. The FSRS columns use the
library's own field names so a card round-trips untranslated.

**There is no `audio-content` bucket.** PRD 8.3 names one; 8.1C then moves
content audio off Supabase Storage, because the free tier's 1 GB storage and
5 GB/month egress would throttle at a few hundred users while a CDN serves the
same ~230 MB of static Opus for nothing. Storage here is `user-recordings` only:
private, small, genuinely per-user. Objects are keyed `<user_id>/<kind>/<file>`
and the policies check the first path segment.

**Content ids are the ids from the YAML** (`c_0412`, `s_0088`, `b1_u1`), not
surrogate uuids. A failing query in a log names the content that broke.

## Connecting from the app

| File | Used by | Key | RLS |
|---|---|---|---|
| `lib/supabase/client.ts` | client components | publishable | applies |
| `lib/supabase/server.ts` | server components, actions, route handlers | publishable | applies |
| `lib/supabase/admin.ts` | the seed script, nothing else | **secret** | **bypassed** |
| `proxy.ts` | every request | publishable | applies |

The publishable key is public by design. Every query it makes is still filtered
by row-level security — the policy is the security boundary, never the key.

**On which secret key to use:** this project issues both a legacy `service_role`
JWT and a newer `sb_secret_…` key. Only the JWT authenticates against the data
API today — the `sb_secret_` key returns 401 from PostgREST. `lib/supabase/env.ts`
accepts either name, so switching is one line in `.env.local` once the project is
migrated to the new key system.

Two details that are easy to get wrong and expensive to get wrong:

- **`getUser()`, never `getSession()`,** in anything that gates access. A session
  read from a cookie is client-supplied data; `getUser()` revalidates the JWT
  with the auth server.
- **`proxy.ts`, not `middleware.ts`.** Next 16 deprecated and renamed the
  convention. Every Supabase SSR example still says middleware; the code is the
  same, the filename is not. It also passes the `headers` argument that
  `@supabase/ssr` now hands to `setAll` — those are `Cache-Control: private,
  no-store` and friends, and dropping them lets a CDN serve one learner's
  session token to the next visitor.

## Changing the schema

```bash
# edit or add a file in migrations/, then:
npm run db:reset      # local: rebuild from scratch, catches ordering mistakes
npm run db:push       # hosted: apply what has not been applied
npm run db:types      # regenerate lib/supabase/database.types.ts
npm run test:rls      # prove the policies still hold
```

`lib/supabase/database.types.ts` is **generated — never edit it**, or the next
`db:types` silently discards the edit. Anything hand-written about the schema
goes in `lib/supabase/types.ts`, which derives from it: readable enum aliases,
and the shapes of the `jsonb` columns that Postgres only knows as `json`.
