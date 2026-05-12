import Link from "next/link";
import { getTradesAction, type TradeFilter } from "@/lib/actions/trades";

const FILTERS: { value: TradeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "auto_verified", label: "Auto-Verified" },
  { value: "manual", label: "Manual" },
  { value: "draft", label: "Draft" },
];

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

function parseFilter(value: string | undefined): TradeFilter {
  if (value === "auto_verified" || value === "manual" || value === "draft") {
    return value;
  }
  return "all";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPnl(pnl: number | null): { text: string; className: string } {
  if (pnl === null || pnl === undefined)
    return { text: "—", className: "text-gray-500" };
  if (pnl > 0) return { text: pnl.toFixed(2), className: "text-green-400" };
  if (pnl < 0) return { text: pnl.toFixed(2), className: "text-red-400" };
  return { text: pnl.toFixed(2), className: "text-gray-500" };
}

export default async function TradesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const filter = parseFilter(sp.filter);

  const result = await getTradesAction({ page, filter });

  if ("error" in result) {
    return (
      <div className="p-6">
        <div className="rounded border border-red-700 bg-red-950 p-4 text-red-200">
          Error: {result.error}
        </div>
      </div>
    );
  }

  const { trades, total, pageSize } = result;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const isFirst = page <= 1;
  const isLast = page >= totalPages;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-white">Trade Journal</h1>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          const cls = active
            ? "bg-yellow-500 text-black font-semibold"
            : "border border-gray-600 text-gray-300 hover:border-gray-400";
          return (
            <Link
              key={f.value}
              href={`/trades?filter=${f.value}&page=1`}
              className={`px-3 py-1.5 rounded text-sm ${cls}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-800">
            <tr>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Pair</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Direction</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Lots</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Entry</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Exit</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">P&amp;L</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Result</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Trust</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Opened</th>
              <th className="text-gray-400 text-xs uppercase tracking-wider px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-gray-900 divide-y divide-gray-700">
            {trades.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-gray-500 px-4 py-6 text-center text-sm">
                  No trades found
                </td>
              </tr>
            ) : (
              trades.map((t) => {
                const pnl = formatPnl(t.pnl);
                const badge = t.trust_badge ? TRUST_BADGES[t.trust_badge] : null;
                return (
                  <tr key={t.id}>
                    <td className="text-gray-100 px-4 py-3 text-sm font-medium">{t.pair}</td>
                    <td className="text-gray-100 px-4 py-3 text-sm">{t.direction}</td>
                    <td className="text-gray-100 px-4 py-3 text-sm">{t.lot_size ?? "—"}</td>
                    <td className="text-gray-100 px-4 py-3 text-sm">{t.entry_price ?? "—"}</td>
                    <td className="text-gray-100 px-4 py-3 text-sm">{t.exit_price ?? "—"}</td>
                    <td className={`px-4 py-3 text-sm ${pnl.className}`}>{pnl.text}</td>
                    <td className="text-gray-100 px-4 py-3 text-sm capitalize">{t.result ?? "—"}</td>
                    <td className="text-gray-100 px-4 py-3 text-sm">
                      {badge ? (
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${badge.className}`}
                        >
                          <span>{badge.emoji}</span>
                          <span>{badge.label}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-gray-100 px-4 py-3 text-sm">{formatDate(t.open_time)}</td>
                    <td className="text-gray-100 px-4 py-3 text-sm">
                      <Link
                        href={{ pathname: `/trades/${t.id}` }}
                        className="text-yellow-400 hover:text-yellow-300"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/trades?filter=${filter}&page=${prevPage}`}
            aria-disabled={isFirst}
            tabIndex={isFirst ? -1 : undefined}
            className={`border border-gray-600 text-gray-300 px-4 py-2 rounded text-sm ${
              isFirst ? "pointer-events-none opacity-40" : "hover:border-gray-400"
            }`}
          >
            Previous
          </Link>
          <Link
            href={`/trades?filter=${filter}&page=${nextPage}`}
            aria-disabled={isLast}
            tabIndex={isLast ? -1 : undefined}
            className={`border border-gray-600 text-gray-300 px-4 py-2 rounded text-sm ${
              isLast ? "pointer-events-none opacity-40" : "hover:border-gray-400"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
