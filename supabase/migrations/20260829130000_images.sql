-- Image slots (docs/ROADMAP.md #6).
--
-- The taper had no terminus: at the least-supported level Meet withdraws the
-- Spanish gloss and replaces it with nothing, because a chunk's meaning was
-- only ever a Spanish string. An image is the one $0 route to meaning that is
-- neither Spanish nor an English definition a beginner cannot read.
--
-- Nullable everywhere. Most of the course cannot be pictured -- "I don't
-- understand", "Give me a moment" -- and the schema must never imply it can.
-- Concrete nouns, frame fillers and six cast portraits are the whole scope.
alter table chunks add column image_url text;
alter table characters add column portrait_url text;
-- {"a coffee": "/images/coffee.svg", ...} keyed by the literal filler text.
alter table frames add column filler_images jsonb not null default '{}'::jsonb;
