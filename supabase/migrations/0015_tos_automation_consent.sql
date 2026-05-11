ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tos_automation_accepted_at timestamptz;

COMMENT ON COLUMN public.profiles.tos_automation_accepted_at IS
  'Timestamp when the user accepted the automated trading journal TOS. NULL means not yet accepted.';
