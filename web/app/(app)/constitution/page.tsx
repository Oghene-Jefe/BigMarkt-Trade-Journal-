import { supabaseServer } from "@/lib/supabase/server";
import { getActiveAccount } from "@/lib/accounts";
import { PageHeader } from "@/components/ui";
import ConstitutionForm, { type ConstitutionData } from "./ConstitutionForm";

export const dynamic = "force-dynamic";

// Sensible empty defaults when the user hasn't authored a constitution yet —
// every rule off, trailing risk mode, private adherence.
const EMPTY: ConstitutionData = {
  is_active: true,
  max_risk_pct: null,
  require_stop_loss: false,
  max_trades_per_day: null,
  allowed_instruments: null,
  min_rr: null,
  max_daily_loss_pct: null,
  risk_mode: "trailing",
  risk_baseline: null,
  adherence_visibility: "private",
  custom_rules: [],
};

export default async function ConstitutionPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const [{ data: row }, { activeId }] = await Promise.all([
    sb
      .from("trading_constitutions")
      .select(
        "is_active, max_risk_pct, require_stop_loss, max_trades_per_day, allowed_instruments, min_rr, max_daily_loss_pct, risk_mode, risk_baseline, adherence_visibility, custom_rules",
      )
      .eq("user_id", user!.id)
      .maybeSingle(),
    getActiveAccount(sb, user!.id),
  ]);

  // Active account starting balance (fallback to profile) for the risk preview.
  let startingBalance: number | null = null;
  if (activeId) {
    const { data: acct } = await sb
      .from("broker_accounts")
      .select("starting_balance")
      .eq("id", activeId)
      .maybeSingle();
    startingBalance = (acct?.starting_balance as number | null) ?? null;
  }
  if (startingBalance == null) {
    const { data: prof } = await sb
      .from("profiles")
      .select("starting_balance")
      .eq("id", user!.id)
      .maybeSingle();
    startingBalance = (prof?.starting_balance as number | null) ?? null;
  }

  const data: ConstitutionData = row
    ? {
        is_active: row.is_active ?? true,
        max_risk_pct: row.max_risk_pct ?? null,
        require_stop_loss: row.require_stop_loss ?? false,
        max_trades_per_day: row.max_trades_per_day ?? null,
        allowed_instruments: (row.allowed_instruments as string[] | null) ?? null,
        min_rr: row.min_rr ?? null,
        max_daily_loss_pct: row.max_daily_loss_pct ?? null,
        risk_mode: row.risk_mode === "static" ? "static" : "trailing",
        risk_baseline: row.risk_baseline ?? null,
        adherence_visibility: row.adherence_visibility === "public" ? "public" : "private",
        custom_rules: Array.isArray(row.custom_rules)
          ? (row.custom_rules as { id: string; text: string }[])
          : [],
      }
    : EMPTY;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trading Constitution"
        description="Your self-imposed rules. We flag trades that break them — your edge is discipline, not perfection."
      />
      <ConstitutionForm data={data} startingBalance={startingBalance} />
    </div>
  );
}
