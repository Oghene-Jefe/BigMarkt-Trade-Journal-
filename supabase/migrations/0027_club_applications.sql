CREATE TABLE public.club_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  university text NOT NULL,
  country text NOT NULL,
  track_interest text,
  application_type text DEFAULT 'member',
  referral_source text,
  why_join text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.club_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON public.club_applications
  USING (false) WITH CHECK (false);
