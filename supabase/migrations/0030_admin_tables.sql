-- Session 8: admin panel tables.
--
-- Only creates tables confirmed missing from the prior migration set:
--   * brokers              — public broker-listing catalog (NOT broker_accounts,
--                            which is user-side, nor broker_submissions, which
--                            is the public submission queue).
--   * leaderboard_overrides — admin score overrides + bans, independent of
--                            account_scores (which is the computed-score table).
--
-- The notifications table already exists (added pre-0024). We do NOT recreate
-- it. Instead we widen its `type` CHECK constraint to admit the new
-- 'announcement' kind used by the broadcast feature.

-- ----------------------------------------------------------------------------
-- brokers (public catalog)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.brokers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  logo_url        TEXT,
  website_url     TEXT,
  description     TEXT,
  is_recommended  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brokers_public_read" ON public.brokers
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "admin_all_brokers" ON public.brokers
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- leaderboard_overrides
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leaderboard_overrides (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_override   NUMERIC,
  is_banned        BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason       TEXT,
  override_reason  TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.leaderboard_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_overrides" ON public.leaderboard_overrides
  FOR ALL USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- profiles.is_banned — flag used by user-management page. Optional column
-- (NULL = active). Kept here so we don't touch any earlier migration.
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS banned_reason TEXT,
  ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;

-- ----------------------------------------------------------------------------
-- notifications.type — widen CHECK to allow 'announcement' broadcasts.
-- ----------------------------------------------------------------------------
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'leader_suspended',
    'leader_under_review',
    'leader_inactive',
    'leader_reinstated',
    'score_updated',
    'dispute_opened',
    'dispute_resolved',
    'subscription_cancelled',
    'new_follower',
    'announcement'
  ));
