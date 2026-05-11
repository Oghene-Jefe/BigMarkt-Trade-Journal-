-- Crowd-sourced broker submissions. Anonymous inserts allowed; reads/updates
-- restricted to service_role so admins triage submissions out-of-band.

CREATE TABLE IF NOT EXISTS public.broker_submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  broker_name  text NOT NULL,
  platform     text NOT NULL,
  website      text,
  notes        text,
  status       text NOT NULL DEFAULT 'pending',
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.broker_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can submit a broker.
DROP POLICY IF EXISTS broker_submissions_insert_any ON public.broker_submissions;
CREATE POLICY broker_submissions_insert_any
  ON public.broker_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Reads/updates/deletes are service_role only. No policy for anon/authenticated
-- on SELECT/UPDATE/DELETE → RLS denies by default.
