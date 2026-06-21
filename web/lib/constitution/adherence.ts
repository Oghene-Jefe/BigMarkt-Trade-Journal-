// Trade-level constitution adherence (SYSTEM rules only — custom rules are
// self-attested and excluded). Adherence = % of evaluated trades that broke
// ZERO rules. Pure-ish: reads the DB, no writes.

import type { SupabaseClient } from "@supabase/supabase-js";

export type Adherence = {
  evaluated: number;
  clean: number;
  pct: number | null; // null when nothing has been evaluated yet
  brokenByRule: Record<string, number>;
};

export async function computeAdherence(
  supabase: SupabaseClient,
  userId: string,
): Promise<Adherence | null> {
  // 1. Active constitution, with its start instant.
  const { data: con } = await supabase
    .from("trading_constitutions")
    .select("is_active, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!con || con.is_active !== true) return null;

  const since = con.created_at as string;

  // 2. Evaluated trades: finalized (closed OR has a result) and created on/after
  //    the constitution started. Open/pending trades are not yet evaluated.
  const { data: tradeRows } = await supabase
    .from("trades")
    .select("id")
    .eq("user_id", userId)
    .gte("created_at", since)
    // visibility = 'exclude' drops a trade from stats (per-trade visibility
    // spec); 'private' still counts. visibility is NOT NULL default 'private'.
    .neq("visibility", "exclude")
    .or("status.eq.closed,result.not.is.null");

  const evaluatedIds = new Set(((tradeRows ?? []) as { id: string }[]).map((t) => t.id));
  const evaluated = evaluatedIds.size;

  if (evaluated === 0) {
    return { evaluated: 0, clean: 0, pct: null, brokenByRule: {} };
  }

  // 3. Violations — only those on evaluated trades count.
  const { data: vios } = await supabase
    .from("constitution_violations")
    .select("trade_id, rule_key")
    .eq("user_id", userId);

  const tradesWithViolation = new Set<string>();
  const brokenByRule: Record<string, number> = {};
  for (const v of (vios ?? []) as { trade_id: string; rule_key: string }[]) {
    if (!evaluatedIds.has(v.trade_id)) continue;
    tradesWithViolation.add(v.trade_id);
    brokenByRule[v.rule_key] = (brokenByRule[v.rule_key] ?? 0) + 1;
  }

  const clean = evaluated - tradesWithViolation.size;
  const pct = Math.round((clean / evaluated) * 100);

  return { evaluated, clean, pct, brokenByRule };
}
