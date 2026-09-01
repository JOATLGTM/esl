-- "Has hablado inglés con N personas" is shown on /home as a fact about the
-- world, and until now it was a tap count: nothing stopped a second report of
-- the same mission, and countPeopleSpokenTo counted rows. A number presented
-- as a fact must be one.
--
-- Unique per (user, mission) rather than distinct-count in the query, for the
-- same reason `learned_requires_production` is a CHECK: the rule should live
-- where no code path can miss it. The insert uses ignoreDuplicates, so a
-- double-tap files nothing and fails nothing.
alter table mission_reports
  add constraint mission_reports_once unique (user_id, mission_id);
