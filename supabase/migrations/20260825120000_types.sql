-- Types and helpers.
--
-- Everything in this file is vocabulary the rest of the schema speaks. The
-- values come from the PRD and are deliberately narrow: a typo in a CEFR level
-- or a contrast id should fail at write time, not surface as an empty drill
-- three weeks later.

-- ---------------------------------------------------------------------------
-- Curriculum vocabulary
-- ---------------------------------------------------------------------------

-- PRD 4.3. Not the standard CEFR ladder: the half-steps are how the six blocks
-- divide up, and the curriculum is the thing this column describes.
create type cefr_level as enum ('A0', 'A1', 'A1+', 'A2', 'A2+', 'B1');

-- PRD 4.4, in priority order. These are the nine points where a Spanish L1
-- systematically mishears or mispronounces English -- not a general phonetics
-- syllabus, a transfer-error list.
create type contrast as enum (
  'ee_ih',              -- sheep / ship
  'schwa',              -- about, sofa
  'final_clusters',     -- text, worked  (drops the -ed past tense)
  'b_v',                -- berry / very
  's_onset',            -- school, not eschool
  'aspiration',         -- pin, top, cat
  'th',                 -- think, this
  'h_r',                -- house, red
  'stress_intonation'   -- PHOtograph / phoTOGraphy
);

-- PRD 4.2. The five stages run in this order, every day, and cannot be skipped.
create type session_stage as enum ('ear', 'meet', 'absorb', 'retrieve', 'speak');

-- PRD 4.5 / F5.
create type speaking_mode as enum ('scripted', 'guided', 'open_response');

-- ---------------------------------------------------------------------------
-- Learning state
-- ---------------------------------------------------------------------------

-- PRD F2. `learned` is gated by a check constraint on user_cards, not by
-- convention: a card cannot reach it on recognition passes alone.
create type card_state as enum ('new', 'learning', 'review', 'learned');

-- PRD F2. Cycled by card maturity, never chosen by the user -- letting someone
-- pick `recognize` forever is exactly the failure mode the product exists to
-- avoid.
create type review_mode as enum ('recognize', 'produce_typed', 'produce_spoken');

-- PRD F1 onboarding: picks mission and scenario emphasis.
create type motivation as enum ('work', 'travel', 'family', 'study', 'other');

-- PRD F11, three-stage shadowing progression.
create type shadowing_stage as enum ('listen', 'repeat', 'shadow');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Every RLS policy in this schema is written as `(select auth.uid()) = user_id`
-- rather than `auth.uid() = user_id`. The subquery form is evaluated once per
-- statement instead of once per row, which is the difference between a review
-- queue that loads instantly and one that scans. It reads like a stylistic
-- quirk; it is a performance decision.
