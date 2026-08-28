-- Alternative answers an author is willing to accept for a chunk (PRD F2).
--
-- The grader already forgives case, punctuation, accents, contraction and a
-- length-scaled typo budget. What it cannot infer is that "Thanks" is a fine
-- answer for "Thank you" while "Good night" is not a fine answer for "Good
-- morning" -- that is a judgement about the language, and it belongs with the
-- person writing the content rather than in a distance metric.
--
-- Empty for almost every chunk. It exists for the handful where a beginner will
-- reasonably produce something else correct, and being told "no" would teach
-- them that their correct English is wrong.
alter table chunks add column accepts jsonb not null default '[]'::jsonb;

comment on column chunks.accepts is
  'Author-declared alternative correct answers. The grader handles form (case, contraction, typos); this handles meaning.';
