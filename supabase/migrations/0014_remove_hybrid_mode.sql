ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_journal_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_journal_mode_check
    CHECK (journal_mode IN ('manual', 'automated'));
UPDATE public.profiles SET journal_mode = 'manual' WHERE journal_mode = 'hybrid';
