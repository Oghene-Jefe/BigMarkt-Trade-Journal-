CREATE TABLE public.bootcamp_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  experience_level text NOT NULL,
  why_join text,
  referral_source text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bootcamp_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON public.bootcamp_applications
  USING (false) WITH CHECK (false);
