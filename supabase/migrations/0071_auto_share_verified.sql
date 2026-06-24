-- 0071_auto_share_verified.sql
--
-- C2 Step 2: per-user opt-in to share verified EA trades with followers.
--
-- When auto_share_verified = true on a user's profile, the EA ingest
-- writes new live verified trades as visibility='followers_only' instead
-- of the default 'private'. This is the primary unblocker for the
-- following feed — without it get_following_feed() returns no rows.
--
-- No RLS change needed: users update their own profile row, covered by
-- the existing self-update policy. The column is false by default so
-- existing users are not affected.
--
-- Idempotent (IF NOT EXISTS). Safe to re-run against prod.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auto_share_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.auto_share_verified IS
  'When true, new verified EA trades are written as followers_only instead of private, feeding the follow feed.';
