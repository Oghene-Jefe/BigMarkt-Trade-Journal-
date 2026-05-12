import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

const TRUST_BADGES: Record<
  string,
  { emoji: string; label: string; className: string }
> = {
  auto_verified: {
    emoji: "🔵",
    label: "AUTO",
    className: "bg-blue-900 text-blue-200",
  },
  manual: {
    emoji: "🟡",
    label: "MANUAL",
    className: "bg-yellow-900 text-yellow-200",
  },
  draft: {
    emoji: "⚪",
    label: "DRAFT",
    className: "bg-gray-700 text-gray-300",
  },
  edited: {
    emoji: "🔴",
    label: "EDITED",
    className: "bg-red-900 text-red-200",
  },
  prop_firm: {
    emoji: "🟠",
    label: "PROP",
    className: "bg-orange-900 text-orange-200",
  },
};

const SELECT_FIELDS =
  "id, pair, direction, lot_size, entry_price, exit_price, pnl, result, notes, ticket, open_time, close_time, swap, commission, magic, comment, trust_badge, capture_source, created_at";

function fmtDateTime(value: unknown): string {
  if (!value || typeof value !== "string") return "—";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

function Field({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <div className="text-gray-400 text-sm">{label}</div>
      <div className={`text-white font-medium ${valueClass ?? ""}`}>{value}</div>
    </div>
  );
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
        <Link href="/trades" className="text-gray-400 hover:text-white text-sm">
          ← Back to Trades
        </Link>
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 text-center text-gray-400">
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
    pnl === null
      ? "text-gray-500"
      : pnl > 0
        ? "text-green-400"
        : pnl < 0
          ? "text-red-400"
          : "text-gray-300";

  const direction = typeof t.direction === "string" ? t.direction.toUpperCase() : null;
  const directionClass =
    direction === "BUY"
      ? "bg-green-900 text-green-300"
      : direction === "SELL"
        ? "bg-red-900 text-red-300"
        : "bg-gray-700 text-gray-300";

  const result = typeof t.result === "string" ? t.result.toUpperCase() : null;
  const resultClass =
    result === "WIN"
      ? "bg-green-900 text-green-300"
      : result === "LOSS"
        ? "bg-red-900 text-red-300"
        : "bg-gray-700 text-gray-300";

  const hasExecution =
    t.ticket != null ||
    t.open_time != null ||
    t.close_time != null ||
    t.swap != null ||
    t.commission != null ||
    t.magic != null ||
    (typeof t.comment === "string" && t.comment.length > 0);

  const notes = typeof t.notes === "string" ? t.notes : "";

  return (
    <div className="p-6">
      <Link
        href="/trades"
        className="text-gray-400 hover:text-white text-sm mb-6 inline-block"
      >
        ← Back to Trades
      </Link>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <h1 className="text-3xl font-bold text-white">{fmtValue(t.pair)}</h1>
        {direction ? (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${directionClass}`}>
            {direction}
          </span>
        ) : null}
        {badge ? (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}
          >
            <span>{badge.emoji}</span>
            <span>{badge.label}</span>
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="text-gray-400 text-sm">Trade Summary</div>
          <div className={`text-4xl font-bold mt-1 ${pnlClass}`}>
            {pnl !== null ? pnl.toFixed(2) : "—"}
          </div>
          {result ? (
            <span
              className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-semibold ${resultClass}`}
            >
              {result}
            </span>
          ) : null}

          <div className="grid grid-cols-2 gap-4 mt-5">
            <Field label="Entry Price" value={fmtValue(t.entry_price)} />
            <Field label="Exit Price" value={fmtValue(t.exit_price)} />
            <Field label="Lot Size" value={fmtValue(t.lot_size)} />
            <Field label="RR Ratio" value={fmtValue(t.rr_ratio)} />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5">
          <div className="text-gray-400 text-sm mb-3">Trade Context</div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Pair" value={fmtValue(t.pair)} />
            <Field label="Session" value={fmtValue(t.session)} />
            <Field label="Strategy" value={fmtValue(t.strategy)} />
            <Field label="Setup Grade" value={fmtValue(t.setup_grade)} />
            <Field label="Emotions" value={fmtValue(t.emotions)} />
            <Field label="Tags" value={fmtValue(t.tags)} />
          </div>

          {notes ? (
            <div className="text-gray-300 text-sm mt-3 italic">{notes}</div>
          ) : null}
        </div>
      </div>

      {hasExecution ? (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 mt-4">
          <div className="text-gray-400 text-sm mb-3">Execution Details</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Field label="Ticket" value={fmtValue(t.ticket)} />
            <Field label="Open Time" value={fmtDateTime(t.open_time)} />
            <Field label="Close Time" value={fmtDateTime(t.close_time)} />
            <Field label="Swap" value={fmtValue(t.swap)} />
            <Field label="Commission" value={fmtValue(t.commission)} />
            <Field label="Magic" value={fmtValue(t.magic)} />
            <Field label="Comment" value={fmtValue(t.comment)} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
