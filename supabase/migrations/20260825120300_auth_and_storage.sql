-- Signup wiring and private recording storage.

-- ---------------------------------------------------------------------------
-- A profile row per auth user
-- ---------------------------------------------------------------------------

-- Created by a trigger rather than by the client, so there is no window in
-- which an authenticated request can insert a profile row for a uuid that is
-- not theirs -- which is why `users` has no insert policy at all.
--
-- `security definer` is required to write a table the new user cannot yet see,
-- and `set search_path = ''` is required because of it: without a pinned
-- search_path, anyone who can create a schema can shadow `public.users` and
-- have this function write to their table with elevated rights. Every object
-- below is schema-qualified for the same reason.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, timezone)
  values (
    new.id,
    -- Set properly during onboarding; a default here only keeps the daily
    -- quest reset from landing at a nonsense hour on day one.
    coalesce(new.raw_user_meta_data ->> 'timezone', 'UTC')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------------

-- Only ONE bucket, and it is private.
--
-- The PRD's 8.3 also names an `audio-content` bucket; 8.1C then moves content
-- audio off Supabase Storage entirely, because the free tier's 1 GB storage and
-- 5 GB/month egress would throttle at a few hundred users while a CDN serves
-- the same ~230 MB of static Opus for nothing. Content audio lives in
-- `public/audio/` and is served by the CDN with a service worker in front of
-- it, so each learner downloads each file exactly once.
--
-- Supabase Storage is for user recordings only: small, private, and genuinely
-- per-user.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-recordings',
  'user-recordings',
  false,
  -- A 60-second speaking sample at 32 kbps Opus is ~240 KB. 10 MB is generous
  -- enough for an uncompressed browser recording and small enough that a bug
  -- in the upload path cannot fill the bucket.
  10485760,
  array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']
)
on conflict (id) do nothing;

-- Objects are keyed `<user_id>/<kind>/<uuid>.<ext>`, so ownership is the first
-- path segment. Checking that rather than `owner` means a recording stays
-- readable by its learner even if it was uploaded by a server-side route on
-- their behalf.
create policy "recordings are readable by their owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'user-recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "recordings are writable by their owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "recordings are updatable by their owner"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- A learner can delete their own voice. PRD F7 keeps recordings indefinitely as
-- a product promise, not as lock-in.

create policy "recordings are deletable by their owner"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-recordings'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
