-- At most one unfinished session per learner per unit.
--
-- `openSession` has always assumed this: it looks for an incomplete session
-- before creating one, and resumes the most recent. Nothing enforced it, so the
-- assumption was false under the most ordinary condition there is -- two
-- requests for the same page at once. A prefetch racing a navigation is enough:
-- both read no open session, both insert one, and the learner now has a
-- duplicate that will never be finished and that every later query has to pick
-- between. Observed in dev on 2026-08-28, not hypothesised.
--
-- A partial index rather than a plain unique constraint, because the rule is
-- only about *open* sessions. A learner accumulates one completed session per
-- unit per day forever, and those must stay.

-- Older open sessions for the same unit are already unreachable: `openSession`
-- orders by `started_at desc`, so only the newest was ever resumed. Drop them
-- rather than closing them -- a session nothing ever opened is not a practice
-- day, and leaving them completed would inflate every count built on this table.
delete from sessions s
where s.completed_at is null
  and exists (
    select 1
    from sessions newer
    where newer.user_id = s.user_id
      and newer.unit_id = s.unit_id
      and newer.completed_at is null
      and (newer.started_at, newer.id) > (s.started_at, s.id)
  );

create unique index sessions_one_open_per_unit
  on sessions (user_id, unit_id)
  where completed_at is null;

comment on index sessions_one_open_per_unit is
  'One resumable session per learner per unit. openSession relies on this; without it a prefetch racing a navigation creates duplicates.';
