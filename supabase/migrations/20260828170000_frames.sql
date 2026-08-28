-- Frames: patterns with one slot and a list of licensed fillers.
--
-- The course teaches chunks -- whole phrases a beginner can deploy without
-- assembling anything. That is the right on-ramp and the wrong destination: a
-- course built only from fixed strings can say 2,500 things and cannot say the
-- 2,501st. A frame is how the learner is shown the pattern behind the phrases
-- they already have, which is the mechanism by which chunks eventually pay off.
--
-- Content-side rules live in `lib/content/types.ts` and are enforced by
-- `npm run content:validate`, not here: whether a filler is legal depends on
-- where the learner is in the curriculum, which is a question about the whole
-- sequence and not about one row.

create table frames (
  id         text primary key,
  unit_id    text not null references units (id) on delete cascade,

  -- Contains exactly one `{SLOT}`, whose name is the `slot` column.
  pattern    text not null,
  es_pattern text not null,
  slot       text not null,
  cefr       cefr_level not null,
  tags       jsonb not null default '[]'::jsonb,

  -- Chunk ids licensed to fill the slot. Deliberately jsonb rather than a join
  -- table: fillers are an ordered authored list, they are never queried across
  -- frames, and the validator has already proved every id resolves to a chunk
  -- the learner has met by this point in the curriculum.
  fillers         jsonb not null default '[]'::jsonb,

  -- Fillers that are not chunks: names, places, numbers. Unit 1 forced this --
  -- `My name is`, `I'm from` and `This is` are frames wearing a chunk's
  -- clothes, and "Alex" and "Mexico" are things the curriculum will never teach
  -- as chunks. Gated at author time by the same readability scorer as
  -- everything else, so they license a word the learner already has.
  literal_fillers jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),

  -- A frame with nothing to put in it is a card the learner cannot answer.
  constraint frames_have_fillers
    check (jsonb_array_length(fillers) + jsonb_array_length(literal_fillers) >= 3)
);
create index frames_unit_idx on frames (unit_id);

-- Same as every other content table: everyone reads, nothing writes.
--
-- No insert/update/delete policy is declared, so with RLS on, every write is
-- denied including from a leaked anon key. The seed script uses the service
-- role, which bypasses RLS. `anon` is included because the landing page shows
-- real content before signup (PRD 7).
alter table frames enable row level security;
create policy frames_readable on frames
  for select to anon, authenticated using (true);
grant select on frames to anon, authenticated;
