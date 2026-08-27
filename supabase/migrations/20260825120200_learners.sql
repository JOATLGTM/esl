-- Learner tables.
--
-- Everything here is one person's private record of what they know, what they
-- got wrong, and what their voice sounds like. RLS is on before there is a
-- single row to leak (PRD Appendix A), and every policy is the same shape:
-- you can see your rows and nobody else's.
--
-- The recordings are the part to be careful with. A speaking sample is
-- somebody's voice, saying beginner English, which they were nervous about
-- making in the first place. It is not analytics data.

-- ---------------------------------------------------------------------------
-- Profile
-- ---------------------------------------------------------------------------

create table users (
  id                      uuid primary key references auth.users (id) on delete cascade,
  native_language         text not null default 'es',
  motivation              motivation,
  current_block           int not null default 1 references blocks (block),
  current_unit            text references units (id),
  -- PRD 4.5. Derived from the block, but overridable -- a learner who reveals
  -- the Spanish gloss on most cards gets offered a step back, and a learner who
  -- wants English chrome at A1 is allowed to have it.
  l1_support_level        int not null default 1 check (l1_support_level between 1 and 5),
  daily_goal_minutes      int not null default 20 check (daily_goal_minutes in (10, 20, 30)),
  timezone                text not null default 'UTC',
  total_xp                int not null default 0 check (total_xp >= 0),
  -- PRD F8: additive, never breakable. This counts total days practiced and
  -- only ever goes up. There is no column for a broken streak because there is
  -- no such thing in this product.
  days_practiced          int not null default 0 check (days_practiced >= 0),
  -- The soft "días seguidos" counter. It may reset, quietly, with no loss
  -- animation and no notification.
  current_consecutive_days int not null default 0 check (current_consecutive_days >= 0),
  last_practiced_on       date,
  leagues_opted_in        boolean not null default false,
  immersion_mode          boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger users_updated_at before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- SRS (PRD F2)
-- ---------------------------------------------------------------------------

create table user_cards (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  chunk_id        text not null references chunks (id) on delete cascade,

  -- The product's notion of maturity, which is not the scheduler's.
  state           card_state not null default 'new',
  -- PRD F2's hard rule, as a constraint rather than a convention: a card may
  -- not reach `learned` until it has passed twice in a PRODUCE mode.
  -- Recognition passes do not count toward mastery, and the database is where
  -- that stops being negotiable.
  produce_passes  int not null default 0 check (produce_passes >= 0),
  constraint learned_requires_production
    check (state <> 'learned' or produce_passes >= 2),

  -- FSRS state, owned by ts-fsrs. These are the library's field names on
  -- purpose: a card round-trips through `ts-fsrs` untranslated, and a rename
  -- here is a bug waiting for a scheduler upgrade.
  --
  -- Note there is no `ease` column. FSRS models memory as stability +
  -- difficulty; SM-2's ease factor has no equivalent, and keeping the name
  -- would describe something the scheduler never computes.
  due_at          timestamptz not null default now(),
  stability       double precision not null default 0,
  difficulty      double precision not null default 0,
  elapsed_days    int not null default 0,
  scheduled_days  int not null default 0,
  learning_steps  int not null default 0,
  reps            int not null default 0,
  lapses          int not null default 0,
  fsrs_state      int not null default 0,
  last_review_at  timestamptz,

  -- PRD F2 acceptance criteria: reveal taps feed the offer to step the Spanish
  -- taper back a level. Counting them is the only way to notice a learner is
  -- quietly not ready.
  gloss_reveals   int not null default 0 check (gloss_reveals >= 0),
  last_mode       review_mode,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, chunk_id)
);
-- The review queue's only query: my cards, due before now, soonest first.
create index user_cards_due_idx on user_cards (user_id, due_at)
  where state <> 'learned'::card_state;
create trigger user_cards_updated_at before update on user_cards
  for each row execute function set_updated_at();

-- What this learner can read, for the 95% gate (PRD F4). Sourced from card
-- state, not from mere exposure: seeing a word in a scene is not knowing it.
create table known_words (
  user_id  uuid not null references users (id) on delete cascade,
  word     text not null,
  source   text not null default 'card',
  added_at timestamptz not null default now(),
  primary key (user_id, word)
);

-- ---------------------------------------------------------------------------
-- Sessions and the daily loop
-- ---------------------------------------------------------------------------

create table sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  unit_id       text not null references units (id),
  -- A partial session resumes at the stage it stopped in (PRD 4.2).
  stage_reached session_stage not null default 'ear',
  xp_earned     int not null default 0 check (xp_earned >= 0),
  -- PRD 3 counter-metric. If time-in-app rises while this falls, the product
  -- is drifting toward passive engagement -- so it is a first-class column,
  -- not something to reconstruct from event logs later.
  speaking_tasks_completed int not null default 0 check (speaking_tasks_completed >= 0),
  duration_s    int not null default 0 check (duration_s >= 0),
  started_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create index sessions_user_idx on sessions (user_id, started_at desc);

create table daily_quests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users (id) on delete cascade,
  quest_date date not null,
  quest_type text not null,
  -- PRD F8: one of the three is always speaking-related.
  is_speaking boolean not null default false,
  target     int not null check (target > 0),
  progress   int not null default 0 check (progress >= 0),
  completed  boolean not null default false,
  unique (user_id, quest_date, quest_type)
);
create index daily_quests_today_idx on daily_quests (user_id, quest_date);

create table achievements (
  user_id         uuid not null references users (id) on delete cascade,
  achievement_key text not null,
  earned_at       timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

-- ---------------------------------------------------------------------------
-- Ear training progress (PRD F3)
-- ---------------------------------------------------------------------------

create table user_contrast_stats (
  user_id      uuid not null references users (id) on delete cascade,
  contrast     contrast not null,
  attempts     int not null default 0 check (attempts >= 0),
  correct      int not null default 0 check (correct >= 0),
  -- Rolling window of the last 30 outcomes, newest last. The adaptive rule
  -- ("retire at >= 90% over 30 trailing items") needs recency, and a lifetime
  -- ratio hides a learner who has just cracked a contrast they used to fail.
  recent       boolean[] not null default '{}',
  last_seen_at timestamptz,
  -- Retired to maintenance, resurfaced every two weeks.
  retired_at   timestamptz,
  primary key (user_id, contrast)
);

-- ---------------------------------------------------------------------------
-- Speaking (PRD F5, F7, F11, F12)
-- ---------------------------------------------------------------------------

create table dialogue_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users (id) on delete cascade,
  dialogue_id   text not null references dialogues (id) on delete cascade,
  -- The node ids walked, in order. Enough to replay the transcript and to
  -- compare against the best-quality path in the debrief.
  path_taken    jsonb not null default '[]'::jsonb,
  used_text_fallback boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);
create index dialogue_runs_user_idx on dialogue_runs (user_id, created_at desc);

create table shadowing_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  scene_id       text not null references scenes (id) on delete cascade,
  segment_index  int not null check (segment_index >= 0),
  stage          shadowing_stage not null,
  -- Null is normal and correct: recording works locally without upload, and
  -- only an explicit save sends anything anywhere (PRD F11).
  recording_path text,
  created_at     timestamptz not null default now()
);
create index shadowing_attempts_user_idx on shadowing_attempts (user_id, created_at desc);

-- PRD F7 / X6, the Speaking Timeline. Week 1 against week 12, side by side.
-- This is the cheapest feature in the product and the one most likely to keep
-- somebody from quitting, so the recordings are kept indefinitely and are
-- never garbage-collected by a retention job.
create table speaking_samples (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  prompt_id      text not null,
  prompt_es      text not null,
  recording_path text not null,
  duration_s     int,
  week_number    int not null check (week_number > 0),
  created_at     timestamptz not null default now()
);
create index speaking_samples_user_idx on speaking_samples (user_id, week_number);

create table mission_reports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users (id) on delete cascade,
  mission_id      text not null references missions (id) on delete cascade,
  -- 😰 😐 🙂
  difficulty_felt int check (difficulty_felt between 1 and 3),
  was_understood  text check (was_understood in ('yes', 'partly', 'no')),
  recording_path  text,
  -- PRD F12: a "failed" mission awards full XP. Attempting is the behaviour
  -- being rewarded, so this column exists to be reported on, never to gate.
  attempted       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index mission_reports_user_idx on mission_reports (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Error patterns (PRD F6)
-- ---------------------------------------------------------------------------

create table error_events (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users (id) on delete cascade,
  -- Deliberately text, not an enum. PRD F6 requires that new patterns can be
  -- added in a config file without touching app code; an enum would make every
  -- new rule a migration.
  error_type     text not null,
  user_text      text not null,
  corrected_text text,
  source         text not null check (source in ('typed', 'asr', 'dialogue', 'cloze')),
  created_at     timestamptz not null default now()
);
-- The only query that matters: has this pattern happened 3+ times in 14 days?
create index error_events_pattern_idx on error_events (user_id, error_type, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: your rows, nobody else's
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
  -- Tables keyed by user_id. `users` is handled separately: its key is `id`.
  owned text[] := array[
    'user_cards', 'known_words', 'sessions', 'daily_quests', 'achievements',
    'user_contrast_stats', 'dialogue_runs', 'shadowing_attempts',
    'speaking_samples', 'mission_reports', 'error_events'
  ];
begin
  foreach t in array (owned || array['users'])
  loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;

  -- Deliberately NOT `force row level security`, which is the obvious next
  -- line and would be a mistake here.
  --
  -- FORCE subjects the table OWNER to its own policies. It buys nothing in this
  -- schema -- the only owner-level access is the service role, which has
  -- BYPASSRLS and bypasses FORCE regardless -- and it breaks signup: the
  -- `handle_new_user` trigger is SECURITY DEFINER and inserts into `users`,
  -- which has no insert policy on purpose. Under FORCE that insert is checked
  -- and denied, and every signup fails on a table that looks correctly locked
  -- down. Nothing in a policy listing would explain it.

  foreach t in array owned
  loop
    -- One policy for all four commands. Splitting them buys nothing here and
    -- makes it easy for one of the four to quietly go missing.
    execute format($p$
      create policy %I on %I
        for all to authenticated
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $p$, t || '_is_own', t);
  end loop;
end
$$;

-- A learner reads and edits their own profile, and cannot create or delete one:
-- the row is created by a trigger at signup and removed by cascade at account
-- deletion. Leaving insert open would let a client forge a row for another uuid
-- in the window before the trigger fires.
create policy users_select_own on users
  for select to authenticated using ((select auth.uid()) = id);
create policy users_update_own on users
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
