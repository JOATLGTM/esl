-- Listening tracks (docs/ROADMAP.md #4) share the scenes table.
--
-- A track is scene-shaped -- lines in cast voices, one stitched file, sentence
-- timings, a title -- so a second table would duplicate the pipeline, the
-- seeder and the player for the sake of a missing `questions` column. What it
-- must NOT share is the daily loop: `pickSceneIndex` deals scenes by count, and
-- `isUnitComplete` finishes a unit on scenes heard. A listening track dealt
-- into either would either replace a story beat or make a unit unfinishable.
-- So every reader that counts or picks scenes filters on `kind = 'story'`.
alter table scenes
  add column kind text not null default 'story'
    check (kind in ('story', 'listening'));
create index scenes_unit_kind_idx on scenes (unit_id, kind);
