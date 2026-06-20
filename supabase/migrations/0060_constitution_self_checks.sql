-- Migration 0060: Trading Constitution custom-rule self-attestation
--
-- Per-trade, owner-attested status for the user's CUSTOM rules
-- (trading_constitutions.custom_rules[].id) — the self-defined rules the engine
-- can't auto-check. This is deliberately separate from constitution_violations
-- (system rules) and is NEVER blended into system-rule adherence (B3).
--
-- One row per (trade, custom rule). Idempotent.

CREATE TABLE IF NOT EXISTS public.constitution_self_checks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id    uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rule_id     text NOT NULL,  -- the custom_rules[].id this attestation is for
  status      text NOT NULL CHECK (status IN ('followed','broke')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, rule_id)
);

CREATE INDEX IF NOT EXISTS idx_constitution_self_checks_trade ON public.constitution_self_checks(trade_id);

-- ── RLS — full self-management (these are the user's own reflections) ─────────
ALTER TABLE public.constitution_self_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS self_checks_self_select ON public.constitution_self_checks;
CREATE POLICY self_checks_self_select ON public.constitution_self_checks
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS self_checks_self_insert ON public.constitution_self_checks;
CREATE POLICY self_checks_self_insert ON public.constitution_self_checks
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS self_checks_self_update ON public.constitution_self_checks;
CREATE POLICY self_checks_self_update ON public.constitution_self_checks
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS self_checks_self_delete ON public.constitution_self_checks;
CREATE POLICY self_checks_self_delete ON public.constitution_self_checks
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── updated_at trigger (reuses tg_set_updated_at from 0023) ───────────────────
DROP TRIGGER IF EXISTS tg_constitution_self_checks_updated_at ON public.constitution_self_checks;
CREATE TRIGGER tg_constitution_self_checks_updated_at
  BEFORE UPDATE ON public.constitution_self_checks
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
