-- 0024_notification_new_follower.sql
-- Extends the notifications.type CHECK constraint to include new_follower
-- Required for Session C follow notification trigger to work at runtime

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
    'new_follower'::text
  ]));
