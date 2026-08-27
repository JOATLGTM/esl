-- Content tables: the curriculum, seeded from YAML.
--
-- These are public-read and service-role-write (PRD 8.3). A learner needs to
-- read every chunk and scene in the block they are on, there is nothing private
-- in any of it, and the alternative -- proxying content through an API route --
-- buys no security and costs a round trip on every card.
--
-- Nothing writes here from the client. Content arrives via `npm run
-- content:seed`, which uses the service role key and never runs in a browser.
--
-- Ids are the ids from the YAML (`c_0412`, `s_0088`, `b1_u1`), not surrogate
-- uuids. They are stable, human-readable, and they mean a failing query in a
-- log names the content that broke.

-- ---------------------------------------------------------------------------
-- The cast (PRD 4.3)
-- ---------------------------------------------------------------------------

create table characters (
  id            text primary key,
  name          text not null,
  -- The voice id from content/voices.yaml. One voice per character, forever:
  -- a learner who recognises Ana before she says her name is getting immersion
  -- for free, and that only survives if her voice never drifts.
  voice         text not null,
  role_es       text not null,
  role_en       text not null,
  speaks_english text not null check (speaks_english in ('native', 'learner')),
  created_at    timestamptz not null default now(),
  unique (voice)
);

-- The humans who read minimal pairs (PRD 8.1B). Here so the drill UI can name
-- an accent honestly -- "Indian English", not "Speaker 4".
create table speakers (
  id          text primary key,
  accent      text not null,
  gender      text not null,
  native      boolean not null,
  l1          text not null,
  source      text not null check (source in ('volunteer', 'corpus')),
  attribution text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Curriculum
-- ---------------------------------------------------------------------------

create table blocks (
  block                   int primary key check (block between 1 and 6),
  title_es                text not null,
  cefr                    cefr_level not null,
  can_do_es               text not null,
  chunk_target_cumulative int not null,
  -- PRD 4.5: how much Spanish the UI still speaks at this point.
  l1_support_level        int not null check (l1_support_level between 1 and 5)
);

-- The six blocks are structural, not content: PRD 4.3 fixes them, every unit
-- hangs off one, and `users.current_block` references this table with a default
-- of 1. Seeding them here rather than in the seed script means signup works on
-- a freshly migrated database with no content loaded -- otherwise the very
-- first signup fails a foreign key, which is a miserable thing to debug.
--
-- `npm run content:seed` upserts over these from curriculum.yaml, which stays
-- the source of truth for the wording.
insert into blocks (block, title_es, cefr, can_do_es, chunk_target_cumulative, l1_support_level)
values
  (1, 'Primeros Sonidos', 'A0',  'Puedo presentarme y responder preguntas básicas',                150, 1),
  (2, 'Mi Día',           'A1',  'Puedo describir mi día y mi familia',                            400, 1),
  (3, 'En la Calle',      'A1+', 'Puedo hacer una compra o pedir direcciones',                     700, 2),
  (4, 'Ayer y Mañana',    'A2',  'Puedo contar qué pasó y qué voy a hacer',                       1200, 3),
  (5, 'En el Trabajo',    'A2+', 'Puedo manejar una conversación de trabajo y explicar un problema', 1800, 4),
  (6, 'Mi Opinión',       'B1',  'Puedo dar y defender una opinión en una conversación',           2500, 5)
on conflict (block) do nothing;

create table units (
  id              text primary key,
  block           int not null references blocks (block),
  "order"         int not null,
  title_es        text not null,
  title_en        text not null,
  cefr            cefr_level not null,
  can_do_es       text not null,
  target_contrast contrast not null,
  created_at      timestamptz not null default now(),
  unique (block, "order")
);

create table chunks (
  id         text primary key,
  unit_id    text not null references units (id) on delete cascade,
  en_text    text not null,
  es_gloss   text not null,
  cefr       cefr_level not null,
  example_en text not null,
  example_es text not null,
  tags       jsonb not null default '[]'::jsonb,
  slots      jsonb not null default '[]'::jsonb,
  -- [{voice_id, url, accent}] resolved from content/audio-manifest.json at seed
  -- time. PRD F2 requires >= 2 before publication; the seed script refuses
  -- fewer, because a card that cannot be heard in two voices is not a card.
  audio_urls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index chunks_unit_idx on chunks (unit_id);

create table scenes (
  id           text primary key,
  unit_id      text not null references units (id) on delete cascade,
  title_es     text not null,
  character_id text not null references characters (id),
  audio_url    text,
  duration_s   int,
  -- [{start_ms, end_ms, character, en, es}] -- sentence-level timings, so
  -- tapping a line replays exactly that line (PRD F4).
  transcript   jsonb not null,
  questions    jsonb not null,
  created_at   timestamptz not null default now()
);
create index scenes_unit_idx on scenes (unit_id);

-- ---------------------------------------------------------------------------
-- Ear training (PRD F3)
-- ---------------------------------------------------------------------------

create table contrast_sets (
  contrast   contrast primary key,
  title_es   text not null,
  explain_es text not null,
  created_at timestamptz not null default now()
);

create table minimal_pairs (
  id       text primary key,
  contrast contrast not null references contrast_sets (contrast) on delete cascade,
  word_a   text not null,
  word_b   text not null,
  ipa_a    text not null,
  ipa_b    text not null,
  -- [{speaker_id, word, url}] -- human recordings only. The drill scheduler
  -- needs enough distinct talkers to guarantee no two consecutive items share
  -- a speaker, which is the mechanism the whole exercise depends on.
  audio    jsonb not null default '[]'::jsonb
);
create index minimal_pairs_contrast_idx on minimal_pairs (contrast);

-- ---------------------------------------------------------------------------
-- Speaking (PRD F5, F12)
-- ---------------------------------------------------------------------------

create table dialogues (
  id           text primary key,
  unit_id      text not null references units (id) on delete cascade,
  scenario_es  text not null,
  scenario_en  text not null,
  character_id text not null references characters (id),
  mode         speaking_mode not null,
  -- The whole tree. A dialogue is read once and walked entirely client-side:
  -- no round trip per turn, and the core loop keeps working offline (PRD F10).
  nodes        jsonb not null,
  created_at   timestamptz not null default now()
);
create index dialogues_unit_idx on dialogues (unit_id);

create table missions (
  id               text primary key,
  unit_id          text not null references units (id) on delete cascade,
  title_es         text not null,
  instructions_es  text not null,
  prep_chunk_ids   jsonb not null default '[]'::jsonb,
  prep_dialogue_id text references dialogues (id),
  -- Missions escalate: one word to a stranger, then an order, then a question,
  -- then a conversation, then a phone call.
  difficulty       int not null default 1 check (difficulty between 1 and 5),
  -- For learners with no English speakers nearby (PRD F12).
  alternate_es     text,
  created_at       timestamptz not null default now()
);
create index missions_unit_idx on missions (unit_id);

-- ---------------------------------------------------------------------------
-- RLS: everyone reads, only the seed script writes
-- ---------------------------------------------------------------------------

alter table characters    enable row level security;
alter table speakers      enable row level security;
alter table blocks        enable row level security;
alter table units         enable row level security;
alter table chunks        enable row level security;
alter table scenes        enable row level security;
alter table contrast_sets enable row level security;
alter table minimal_pairs enable row level security;
alter table dialogues     enable row level security;
alter table missions      enable row level security;

-- `anon` is included on purpose: the landing page shows a real 30-second sample
-- lesson before signup (PRD 7), and that has to be able to read content.
--
-- No insert/update/delete policy is declared anywhere in this file. With RLS on
-- and no permissive policy, every write is denied -- including from a leaked
-- anon key. The service role bypasses RLS entirely, which is how the seed
-- script writes and why its key never goes near a browser.
do $$
declare t text;
begin
  foreach t in array array[
    'characters', 'speakers', 'blocks', 'units', 'chunks',
    'scenes', 'contrast_sets', 'minimal_pairs', 'dialogues', 'missions'
  ]
  loop
    execute format(
      'create policy %I on %I for select to anon, authenticated using (true)',
      t || '_readable', t
    );
    execute format('grant select on %I to anon, authenticated', t);
  end loop;
end
$$;
