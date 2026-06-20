import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Pencil } from "lucide-react";
import type { Route } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { signChart } from "@/lib/storage";
import { fmtPct } from "@/lib/format";
import ShareableTradeCard from "@/components/trade/ShareableTradeCard";

const SELECT_FIELDS =
  "id, pair, direction, lot_size, entry_price, exit_price, stop_loss, take_profit, pnl, rr_ratio, return_pct, result, session, strategy, setup_grade, emotions, tags, notes, chart_path, created_at, status, open_time, close_time, order_status, source, trust_badge, capture_source, position_id, ticket";

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

function fmtPrice(n: number | null): string {
  if (n == null) return "—";
  // Locale PINNED to en-US — an unpinned toLocaleString() renders differently on
  // server vs client and has caused hydration crashes.
  return n.toLocaleString("en-US", { maximumFractionDigits: 5 });
}

// Unified R:R: null (→ "—") when there's no stop loss. Otherwise prefer the
// stored ratio, else derive from entry vs realized exit (closed) or target TP
// (open). Mirrors the closed-card logic so the share card and risk strip agree.
function computeRR(args: {
  entry: number | null;
  exit: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  storedRR: number | null;
}): string | null {
  const { entry, exit, stopLoss, takeProfit, storedRR } = args;
  if (stopLoss == null || stopLoss === 0) return null;
  if (storedRR != null && storedRR !== 0) return storedRR.toFixed(2);
  const target = exit != null ? exit : takeProfit;
  if (entry != null && target != null) {
    const risk = Math.abs(entry - stopLoss);
    if (risk > 0) return (Math.abs(target - entry) / risk).toFixed(2);
  }
  return null;
}

function fmtDT(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

const EVENT_LABELS: Record<string, string> = {
  pending_set: "Order Placed",
  pending_modified: "Order Modified",
  pending_cancelled: "Order Cancelled",
  filled: "Order Filled",
  sl_tp_modified: "SL/TP Modified",
  partial_close: "Partial Close",
  closed: "Trade Closed",
};

export default async function TradeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const sb = await supabaseServer();

  const [{ data: trade, error }, { data: events }] = await Promise.all([
    sb
      .from("trades")
      .select(SELECT_FIELDS)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    sb
      .from("trade_events")
      .select("id, event_type, event_time, created_at, price, sl, tp, lots, pnl")
      .eq("trade_id", id),
  ]);

  // Strict chronological order. event_time is the broker wall-clock for
  // fill/close, but sl_tp_modified events log it as null (only created_at is
  // set), and Postgres sorts NULLS LAST — which pushed modifies AFTER the
  // close. Sort on (event_time ?? created_at) so modifies land between fill and
  // close.
  const sortedEvents = [...((events as Array<Record<string, unknown>>) ?? [])].sort((a, b) => {
    const ta = Date.parse((a.event_time ?? a.created_at) as string) || 0;
    const tb = Date.parse((b.event_time ?? b.created_at) as string) || 0;
    return ta - tb;
  });

  const backLink = (
    <Link
      href="/journal"
      className="inline-flex items-center gap-1 text-sm text-muted hover:text-white"
    >
      <ArrowLeft size={14} aria-hidden />
      <span>Back to journal</span>
    </Link>
  );

  if (error || !trade) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 px-4 pb-16">
        {backLink}
        <div className="rounded-lg border border-white/10 bg-panel p-8 text-center text-muted">
          Trade not found.
        </div>
      </div>
    );
  }

  const t = trade as Record<string, unknown>;
  const pair = typeof t.pair === "string" ? t.pair : "";
  const direction = typeof t.direction === "string" && t.direction.toUpperCase() === "SELL" ? "SELL" : "BUY";

  const status = typeof t.status === "string" ? t.status : "closed";
  const isOpen = status === "open";
  const isPending = !isOpen && (t.order_status === "pending" || t.order_status === "modified");
  const isClosed = !isOpen && !isPending;
  const isEa = t.capture_source === "ea";
  const editHref = `/journal/${id}/edit` as Route;

  const entry = typeof t.entry_price === "number" ? t.entry_price : null;
  const exit = typeof t.exit_price === "number" ? t.exit_price : null;
  const stopLoss = typeof t.stop_loss === "number" ? t.stop_loss : null;
  const takeProfit = typeof t.take_profit === "number" ? t.take_profit : null;
  const lotSize = typeof t.lot_size === "number" ? t.lot_size : null;

  // Risk metrics shared by the open + closed cards.
  const returnPct = typeof t.return_pct === "number" ? t.return_pct : null;
  const storedRR = typeof t.rr_ratio === "number" ? t.rr_ratio : null;
  const hasStopLoss = stopLoss != null && stopLoss !== 0;
  const rrRatio = computeRR({ entry, exit, stopLoss, takeProfit, storedRR });

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
      <div className="flex items-center justify-between gap-3">
        {backLink}
        <Link
          href={editHref}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-1.5 text-sm text-muted hover:bg-white/5 hover:text-white"
        >
          <Pencil size={14} aria-hidden />
          <span>{isEa ? "Add context" : "Edit trade"}</span>
        </Link>
      </div>

      {/* Status badge for open/pending trades */}
      {(isOpen || isPending) && (
        <div className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${
          isOpen
            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
        }`}>
          <span className={`h-2 w-2 rounded-full ${isOpen ? "bg-blue-400 animate-pulse" : "bg-yellow-400"}`} />
          {isOpen ? "LIVE / OPEN" : "PENDING ORDER"}
        </div>
      )}

      {isClosed ? (
        <ClosedTradeCard
          t={t}
          pair={pair}
          direction={direction}
          entry={entry}
          exit={exit}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          lotSize={lotSize}
          rrRatio={rrRatio}
          username={username}
          profileUrl={profileUrl}
          createdAt={createdAt}
        />
      ) : (
        <OpenTradeCard
          pair={pair}
          direction={direction}
          entry={entry}
          stopLoss={stopLoss}
          takeProfit={takeProfit}
          lotSize={lotSize}
          openTime={typeof t.open_time === "string" ? t.open_time : null}
          isPending={isPending}
        />
      )}

      {/* Risk metrics — return % + R:R / no-stop-loss discipline */}
      <RiskMetrics returnPct={returnPct} rrRatio={rrRatio} hasStopLoss={hasStopLoss} />

      {/* Chart screenshot */}
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

      {/* Trade notes */}
      {notes ? (
        <section className="space-y-2">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted">Trade Notes</h2>
          <div className="rounded-xl border border-white/10 bg-panel p-4 text-sm text-white whitespace-pre-wrap">
            {notes}
          </div>
        </section>
      ) : null}

      {/* Lifecycle timeline */}
      {sortedEvents.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted">Trade Timeline</h2>
          <div className="rounded-xl border border-white/10 bg-panel px-4 py-3 space-y-0">
            {sortedEvents.map((ev, i) => {
              const eventType = typeof ev.event_type === "string" ? ev.event_type : "";
              const label = EVENT_LABELS[eventType] ?? eventType;
              const price = typeof ev.price === "number" ? ev.price : null;
              const evPnl = typeof ev.pnl === "number" ? ev.pnl : null;
              const evSl = typeof ev.sl === "number" ? ev.sl : null;
              const evTp = typeof ev.tp === "number" ? ev.tp : null;
              const evTime = (typeof ev.event_time === "string" ? ev.event_time : null)
                ?? (typeof ev.created_at === "string" ? ev.created_at : null);
              const isModify = eventType === "sl_tp_modified";
              const isLast = i === sortedEvents.length - 1;
              return (
                <div key={ev.id as string} className="relative flex gap-4">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-gold flex-shrink-0" />
                    {!isLast && <div className="mt-1 flex-1 w-px bg-white/10" />}
                  </div>
                  <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
                    <p className="text-sm font-medium text-white">{label}</p>
                    <p className="text-xs text-muted">{fmtDT(evTime)}</p>
                    {isModify ? (
                      <p className="text-xs text-white/60">
                        SL {fmtPrice(evSl)} · TP {fmtPrice(evTp)}
                      </p>
                    ) : price != null ? (
                      <p className="text-xs text-white/60">Price: {fmtPrice(price)}</p>
                    ) : null}
                    {evPnl != null && (
                      <p className={`text-xs font-mono ${evPnl >= 0 ? "text-win" : "text-loss"}`}>
                        {evPnl >= 0 ? "+" : ""}{evPnl.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// Risk metrics strip — shown for both open and closed trades. Surfaces the
// per-trade return % and either the R:R ratio or a "No stop loss" discipline
// flag (when SL is absent, R:R is meaningless and return % is the risk metric).
function RiskMetrics({
  returnPct, rrRatio, hasStopLoss,
}: {
  returnPct: number | null;
  rrRatio: string | null;
  hasStopLoss: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-md p-2.5 bg-black/30">
        <div className="text-[10px] uppercase tracking-widest text-muted">Return %</div>
        <div
          className={`mt-0.5 font-mono text-base ${
            returnPct == null ? "text-muted" : returnPct >= 0 ? "text-win" : "text-loss"
          }`}
        >
          {returnPct == null ? "—" : fmtPct(returnPct, 2)}
        </div>
      </div>
      <div className="rounded-md p-2.5 bg-black/30">
        <div className="text-[10px] uppercase tracking-widest text-muted">R:R Ratio</div>
        {hasStopLoss ? (
          <div className="mt-0.5 font-mono text-base text-gold">{rrRatio ?? "—"}</div>
        ) : (
          <div className="mt-0.5 flex items-center gap-2">
            <span className="font-mono text-base text-muted">—</span>
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
              No stop loss
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Full shareable card for closed trades
function ClosedTradeCard({
  t, pair, direction, entry, exit, stopLoss, takeProfit, lotSize, rrRatio, username, profileUrl, createdAt,
}: {
  t: Record<string, unknown>;
  pair: string;
  direction: "BUY" | "SELL";
  entry: number | null;
  exit: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number | null;
  rrRatio: string | null;
  username: string;
  profileUrl: string;
  createdAt: string;
}) {
  const storedPnl = typeof t.pnl === "number" ? t.pnl : null;
  let pnl = storedPnl ?? 0;
  if ((storedPnl == null || storedPnl === 0) && entry != null && entry !== 0 && exit != null && exit !== 0 && lotSize != null) {
    const mult = getPnlMultiplier(pair);
    const sign = direction === "BUY" ? 1 : -1;
    pnl = +(sign * (exit - entry) * lotSize * mult).toFixed(2);
  }

  const resultRaw = typeof t.result === "string" ? t.result.toUpperCase() : null;
  const result: "WIN" | "LOSS" | "BE" =
    resultRaw === "WIN" ? "WIN" : resultRaw === "LOSS" ? "LOSS" : "BE";

  return (
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
  );
}

// Lightweight stats card for open/pending trades (no share)
function OpenTradeCard({
  pair, direction, entry, stopLoss, takeProfit, lotSize, openTime, isPending,
}: {
  pair: string;
  direction: "BUY" | "SELL";
  entry: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  lotSize: number | null;
  openTime: string | null;
  isPending: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel p-6 space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="font-display text-3xl tracking-widest text-gold">{pair.toUpperCase()}</h2>
        <span className={`rounded px-2.5 py-1 text-xs font-bold uppercase tracking-wider border ${
          direction === "BUY" ? "bg-win/10 text-win border-win/30" : "bg-loss/10 text-loss border-loss/30"
        }`}>
          {direction}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <PriceCell label="Entry" value={fmtPrice(entry)} />
        <PriceCell label="Stop Loss" value={fmtPrice(stopLoss)} />
        <PriceCell label="Take Profit" value={fmtPrice(takeProfit)} />
        <PriceCell label="Lot Size" value={lotSize != null ? lotSize.toFixed(2) : "—"} />
      </div>
      <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted">
            {isPending ? "Order Time" : "Opened"}
          </div>
          <div className="mt-0.5 text-sm text-white">{fmtDT(openTime)}</div>
        </div>
        <p className="text-xs text-muted">
          {isPending ? "Pending order — awaiting fill" : "Position open — awaiting close"}
        </p>
      </div>
    </div>
  );
}

function PriceCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md p-2.5 bg-black/30">
      <div className="text-[10px] uppercase tracking-widest text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-base text-gold">{value}</div>
    </div>
  );
}
