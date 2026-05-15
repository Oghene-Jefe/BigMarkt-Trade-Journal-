-- =============================================================================
-- 0034_notifications_type_announcement.sql
--
-- 0030_admin_tables.sql added 'announcement' to notifications.type for the
-- broadcast feature, but 0031_session9_foundation.sql later dropped and
-- recreated the check constraint without it. Inserting an announcement
-- notification therefore fails on a freshly migrated database.
--
-- This migration restores 'announcement' and locks the constraint to the
-- complete set of types currently in use.
-- =============================================================================

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
    'announcement'::text,
    'trade_approved'::text,
    'challenge_badge'::text
  ]));
