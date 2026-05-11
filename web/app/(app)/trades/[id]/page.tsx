import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

const TRUST_BADGES: Record<string, { emoji: string; label: string }> = {
  auto_verified: { emoji: "🔵", label: "AUTO" },
  manual: { emoji: "🟡", label: "MANUAL" },
  draft: { emoji: "⚪", label: "DRAFT" },
  edited: { emoji: "🔴", label: "EDITED" },
  prop_firm: { emoji: "🟠", label: "PROP" },
};

const SELECT_FIELDS =
  "id, pair, direction, lot_size, entry_price, exit_price, pnl, result, open_time, close_time, trust_badge, capture_source, notes, created_at, ticket, swap, commission, magic, comment";

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
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
      <div className="p-6 space-y-4">
        <Link href="/trades" className="text-blue-600 hover:underline text-sm">
          ← Back to Trades
        </Link>
        <div className="rounded border border-gray-300 bg-gray-50 p-6 text-center text-gray-600">
          Trade not found.
        </div>
      </div>
    );
  }

  const t = trade as Record<string, unknown>;
  const badgeKey = typeof t.trust_badge === "string" ? t.trust_badge : null;
  const badge = badgeKey ? TRUST_BADGES[badgeKey] : null;
  const pnl = typeof t.pnl === "number" ? t.pnl : null;
  const pnlClass =
    pnl === null ? "" : pnl > 0 ? "text-green-600" : pnl < 0 ? "text-red-600" : "";

  const rows: { label: string; value: string; className?: string }[] = [
    { label: "Pair", value: fmtValue(t.pair) },
    { label: "Direction", value: fmtValue(t.direction) },
    { label: "Lot Size", value: fmtValue(t.lot_size) },
    { label: "Entry Price", value: fmtValue(t.entry_price) },
    { label: "Exit Price", value: fmtValue(t.exit_price) },
    {
      label: "P&L",
      value: pnl !== null ? pnl.toFixed(2) : "—",
      className: pnlClass,
    },
    { label: "Result", value: fmtValue(t.result) },
    { label: "Swap", value: fmtValue(t.swap) },
    { label: "Commission", value: fmtValue(t.commission) },
    { label: "Ticket", value: fmtValue(t.ticket) },
    { label: "Magic", value: fmtValue(t.magic) },
    { label: "Comment", value: fmtValue(t.comment) },
    { label: "Capture Source", value: fmtValue(t.capture_source) },
    { label: "Open Time", value: fmtDateTime(t.open_time as string | null) },
    { label: "Close Time", value: fmtDateTime(t.close_time as string | null) },
    { label: "Created At", value: fmtDateTime(t.created_at as string | null) },
    { label: "Notes", value: fmtValue(t.notes) },
  ];

  return (
    <div className="p-6 space-y-4">
      <Link href="/trades" className="text-blue-600 hover:underline text-sm">
        ← Back to Trades
      </Link>

      <div className="rounded-lg border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h1 className="text-xl font-bold">Trade Detail</h1>
          {badge ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-gray-100 text-xs font-medium">
              <span>{badge.emoji}</span>
              <span>{badge.label}</span>
            </span>
          ) : null}
        </div>

        <dl className="divide-y">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-2 gap-4 px-6 py-3 text-sm"
            >
              <dt className="text-gray-500">{row.label}</dt>
              <dd className={`font-medium ${row.className ?? ""}`}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
