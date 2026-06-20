-- Migration 0058: Trading Constitution (schema only)
--
-- A user-authored set of self-imposed trading rules ("constitution") plus the
-- per-trade deviations recorded when a trade breaks them. The deviation engine
-- (web/lib/constitution/engine.ts) is pure; the hooks that write violations run
-- best-effort and never block trade save / EA ingest.
--
-- This migration adds two tables + RLS. No backfill. Idempotent.

-- ── trading_constitutions ───────────────────────────────────────────────────
-- One per user (UNIQUE user_id). NULL on a rule field = rule not set = skipped.
CREATE TABLE IF NOT EXISTS public.trading_constitutions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_active            boolean NOT NULL DEFAULT true,
  max_risk_pct         numeric,
  require_stop_loss    boolean NOT NULL DEFAULT false,
  max_trades_per_day   int,
  allowed_instruments  text[],
  min_rr               numeric,
  max_daily_loss_pct   numeric,
  risk_mode            text NOT NULL DEFAULT 'trailing'
                         CHECK (risk_mode IN ('trailing','static')),
  risk_baseline        numeric,  -- used when risk_mode = 'static'
  adherence_visibility text NOT NULL DEFAULT 'private'
                         CHECK (adherence_visibility IN ('private','public')),
  custom_rules         jsonb NOT NULL DEFAULT '[]',  -- [{id, text}] self-attested
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ── constitution_violations ─────────────────────────────────────────────────
-- One row per (trade, rule). Recomputed via delete-before-insert per trade.
CREATE TABLE IF NOT EXISTS public.constitution_violations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id    uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  rule_key    text NOT NULL,
  actual      numeric,
  allowed     numeric,
  detail      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trade_id, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_constitution_violations_user ON public.constitution_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_constitution_violations_trade ON public.constitution_violations(trade_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.trading_constitutions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.constitution_violations ENABLE ROW LEVEL SECURITY;

-- trading_constitutions: full self-management.
DROP POLICY IF EXISTS constitutions_self_select ON public.trading_constitutions;
CREATE POLICY constitutions_self_select ON public.trading_constitutions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS constitutions_self_insert ON public.trading_constitutions;
CREATE POLICY constitutions_self_insert ON public.trading_constitutions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS constitutions_self_update ON public.trading_constitutions;
CREATE POLICY constitutions_self_update ON public.trading_constitutions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS constitutions_self_delete ON public.trading_constitutions;
CREATE POLICY constitutions_self_delete ON public.trading_constitutions
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- constitution_violations: self select + self insert only. No update/delete
-- policy — the EA hook writes via the service role (bypasses RLS), and the
-- manual hook writes under the user's own session. Deletes during recompute
-- also run via those privileged/owner paths.
DROP POLICY IF EXISTS violations_self_select ON public.constitution_violations;
CREATE POLICY violations_self_select ON public.constitution_violations
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS violations_self_insert ON public.constitution_violations;
CREATE POLICY violations_self_insert ON public.constitution_violations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- ── updated_at trigger (reuses tg_set_updated_at from 0023) ───────────────────
DROP TRIGGER IF EXISTS tg_trading_constitutions_updated_at ON public.trading_constitutions;
CREATE TRIGGER tg_trading_constitutions_updated_at
  BEFORE UPDATE ON public.trading_constitutions
  FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();
