-- 0031_session9_foundation.sql
-- Session 9: extend notification types, add challenge streak fields, badges table.

-- 1. Extend notifications.type CHECK constraint with trade_approved + challenge_badge
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'leader_suspended'::text,
    'leader_under_review'::text,
    'leader_inactive'::text,
    'leader_reinstated'::text,
    'score_updated'::text,
    'dispute_opened'::text,
    'dispute_resolved'::text,
    'subscription_cancelled'::text,
    'new_follower'::text,
    'trade_approved'::text,
    'challenge_badge'::text
  ]));

-- 2. Challenge streak tracking columns
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS last_trade_date  DATE,
  ADD COLUMN IF NOT EXISTS streak_broken_at TIMESTAMPTZ;

-- 3. Badges table
CREATE TABLE IF NOT EXISTS public.badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_type  TEXT NOT NULL,
  badge_name  TEXT NOT NULL,
  earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata    JSONB
);

CREATE INDEX IF NOT EXISTS idx_badges_user_id ON public.badges(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_badges_user_type ON public.badges(user_id, badge_type);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_own_badges ON public.badges;
CREATE POLICY users_own_badges ON public.badges
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS admin_all_badges ON public.badges;
CREATE POLICY admin_all_badges ON public.badges
  FOR ALL USING (public.is_admin(auth.uid()));
