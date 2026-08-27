-- Onboarding completion.
--
-- The obvious alternative is to infer it -- "onboarded if motivation is not
-- null and current_unit is set" -- and that breaks the moment either field is
-- written by something else, or the flow gains a step that sets neither. A
-- learner bounced back into onboarding they already finished is a bad enough
-- experience to spend a column on.
--
-- Nullable on purpose: null means "has an account, has not finished setting
-- up", which is a real state and the one the redirect checks for.
alter table users add column onboarded_at timestamptz;

-- The mic is optional forever (PRD F1: denying it blocks nothing). This records
-- what happened so the app can stop asking, and so a learner who denied it on a
-- borrowed phone can be offered it again later without being nagged every day.
alter table users add column mic_permission text
  check (mic_permission in ('granted', 'denied', 'unsupported', 'skipped'));

comment on column users.onboarded_at is
  'Null until the 5-step onboarding completes. Drives the /onboarding redirect.';
comment on column users.mic_permission is
  'Last known microphone outcome. Never gates progress — text input is always available (PRD 8.2).';
