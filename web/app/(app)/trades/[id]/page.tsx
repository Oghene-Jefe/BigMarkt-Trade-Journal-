import Link from "next/link";
import Image from "next/image";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { signChart } from "@/lib/storage";
import ShareableTradeCard from "@/components/trade/ShareableTradeCard";

const SELECT_FIELDS =
  "id, pair, direction, lot_size, entry_price, exit_price, stop_loss, take_profit, pnl, rr_ratio, result, session, strategy, setup_grade, emotions, tags, notes, chart_path, created_at";

// Mirrors the formula in TradeForm.tsx — keep in sync.
function getPnlMultiplier(pair: string): number {
  const p = pair.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (p.startsWith("XAU")) return 100;
  if (p.startsWith("XAG")) return 5000;
  const cryptoPrefixes = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOT", "LINK", "DOGE", "MATIC", "BNB", "LTC", "AVAX", "ATOM"];
  if (cryptoPrefixes.some((c) => p.startsWith(c))) return 1;
  if (/^(US30|NAS100|US500|UK100|GER40|DAX|SPX500|NDX|DOW|FTSE|CAC|NIKKEI)/.test(p)) return 1;
  return 10;
}

function parseTags(raw: unknown): string[] | null {
  if (Array.isArray(raw)) {
    const arr = raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    return arr.length ? arr : null;
  }
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((t) => t.trim()).filter(Boolean);
  }
  return null;
}

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data: trade, error } = await sb
    .from("trades")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !trade) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-16">
        <Link href="/trades" className="text-sm text-muted hover:text-white">
          ← Back to Trades
        </Link>
        <div className="rounded-xl border border-white/10 bg-panel p-8 text-center text-muted">
          Trade not found.
        </div>
      </div>
    );
  }

  const t = trade as Record<string, unknown>;
  const pair = typeof t.pair === "string" ? t.pair : "";
  const direction = typeof t.direction === "string" && t.direction.toUpperCase() === "SELL" ? "SELL" : "BUY";

  const entry = typeof t.entry_price === "number" ? t.entry_price : null;
  const exit = typeof t.exit_price === "number" ? t.exit_price : null;
  const stopLoss = typeof t.stop_loss === "number" ? t.stop_loss : null;
  const takeProfit = typeof t.take_profit === "number" ? t.take_profit : null;
  const lotSize = typeof t.lot_size === "number" ? t.lot_size : null;

  // PnL: stored value, with fallback recalculation when zero/null but prices exist.
  const storedPnl = typeof t.pnl === "number" ? t.pnl : null;
  let pnl = storedPnl ?? 0;
  if ((storedPnl == null || storedPnl === 0) && entry != null && entry !== 0 && exit != null && exit !== 0 && lotSize != null) {
    const mult = getPnlMultiplier(pair);
    const sign = direction === "BUY" ? 1 : -1;
    pnl = +(sign * (exit - entry) * lotSize * mult).toFixed(2);
  }

  // RR: stored value, with fallback recalculation.
  const storedRR = typeof t.rr_ratio === "number" ? t.rr_ratio : null;
  let rrRatio: string | null = null;
  if (storedRR != null && storedRR !== 0) {
    rrRatio = storedRR.toFixed(2);
  } else if (entry != null && exit != null && stopLoss != null) {
    const risk = Math.abs(entry - stopLoss);
    if (risk > 0) rrRatio = (Math.abs(exit - entry) / risk).toFixed(2);
  }

  const resultRaw = typeof t.result === "string" ? t.result.toUpperCase() : null;
  const result: "WIN" | "LOSS" | "BREAKEVEN" =
    resultRaw === "WIN" ? "WIN" : resultRaw === "LOSS" ? "LOSS" : "BREAKEVEN";

  const { data: profile } = await sb
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const emailLocal = (user.email ?? "trader").split("@")[0];
  const username =
    (profile?.username && profile.username.trim()) ||
    (profile?.display_name && profile.display_name.trim()) ||
    emailLocal;
  const profileUrl = profile?.username ? `/${profile.username}` : `/p/${user.id}`;

  const createdAt = typeof t.created_at === "string" ? t.created_at : new Date().toISOString();

  const chartPath = typeof t.chart_path === "string" ? t.chart_path : null;
  const chartUrl = chartPath ? await signChart(chartPath) : null;

  const notes = typeof t.notes === "string" && t.notes.trim() ? t.notes : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-16">
      <Link href="/trades" className="inline-block text-sm text-muted hover:text-white">
        ← Back to Trades
      </Link>

      <ShareableTradeCard
        pair={pair}
        direction={direction}
        result={result}
        pnl={pnl}
        rrRatio={rrRatio}
        lotSize={lotSize}
        setupGrade={typeof t.setup_grade === "string" ? t.setup_grade : null}
        entry={entry}
        exit={exit}
        stopLoss={stopLoss}
        takeProfit={takeProfit}
        session={typeof t.session === "string" ? t.session : null}
        strategy={typeof t.strategy === "string" ? t.strategy : null}
        emotions={typeof t.emotions === "string" ? t.emotions : null}
        tags={parseTags(t.tags)}
        username={username}
        profileUrl={profileUrl}
        createdAt={createdAt}
      />

      {chartUrl ? (
        <section className="space-y-2">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted">Chart Screenshot</h2>
          <div className="relative overflow-hidden rounded-xl border border-white/10 bg-panel">
            <Image
              src={chartUrl}
              alt={`${pair} chart`}
              width={1600}
              height={900}
              className="h-auto w-full object-contain"
              unoptimized
            />
          </div>
        </section>
      ) : null}

      {notes ? (
        <section className="space-y-2">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted">Trade Notes</h2>
          <div className="rounded-xl border border-white/10 bg-panel p-4 text-sm text-white whitespace-pre-wrap">
            {notes}
          </div>
        </section>
      ) : null}
    </div>
  );
}
