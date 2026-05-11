import Link from "next/link";
import { getTradesAction, type TradeFilter } from "@/lib/actions/trades";

const FILTERS: { value: TradeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "auto_verified", label: "Auto-Verified" },
  { value: "manual", label: "Manual" },
  { value: "draft", label: "Draft" },
];

const TRUST_BADGES: Record<string, { emoji: string; label: string }> = {
  auto_verified: { emoji: "🔵", label: "AUTO" },
  manual: { emoji: "🟡", label: "MANUAL" },
  draft: { emoji: "⚪", label: "DRAFT" },
  edited: { emoji: "🔴", label: "EDITED" },
  prop_firm: { emoji: "🟠", label: "PROP" },
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
  if (pnl === null || pnl === undefined) return { text: "—", className: "" };
  const className = pnl > 0 ? "text-green-600" : pnl < 0 ? "text-red-600" : "";
  return { text: pnl.toFixed(2), className };
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
        <div className="rounded border border-red-300 bg-red-50 p-4 text-red-700">
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
      <h1 className="text-2xl font-bold">Trade Journal</h1>

      <div className="flex gap-2">
        {FILTERS.map((f) => {
          const active = f.value === filter;
          const cls = active
            ? "bg-primary text-white border-primary"
            : "border-gray-300 text-gray-700 hover:bg-gray-50";
          return (
            <Link
              key={f.value}
              href={`/trades?filter=${f.value}&page=1`}
              className={`px-3 py-1.5 rounded border text-sm ${cls}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-3 py-2">Pair</th>
              <th className="px-3 py-2">Direction</th>
              <th className="px-3 py-2">Lots</th>
              <th className="px-3 py-2">Entry</th>
              <th className="px-3 py-2">Exit</th>
              <th className="px-3 py-2">P&amp;L</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">Trust</th>
              <th className="px-3 py-2">Opened</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-6 text-center text-gray-500">
                  No trades found
                </td>
              </tr>
            ) : (
              trades.map((t) => {
                const pnl = formatPnl(t.pnl);
                const badge = t.trust_badge ? TRUST_BADGES[t.trust_badge] : null;
                return (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2 font-medium">{t.pair}</td>
                    <td className="px-3 py-2">{t.direction}</td>
                    <td className="px-3 py-2">{t.lot_size ?? "—"}</td>
                    <td className="px-3 py-2">{t.entry_price ?? "—"}</td>
                    <td className="px-3 py-2">{t.exit_price ?? "—"}</td>
                    <td className={`px-3 py-2 ${pnl.className}`}>{pnl.text}</td>
                    <td className="px-3 py-2 capitalize">{t.result ?? "—"}</td>
                    <td className="px-3 py-2">
                      {badge ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs font-medium">
                          <span>{badge.emoji}</span>
                          <span>{badge.label}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">{formatDate(t.open_time)}</td>
                    <td className="px-3 py-2">
                      <Link
                        href={{ pathname: `/trades/${t.id}` }}
                        className="text-blue-600 hover:underline"
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
        <div className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/trades?filter=${filter}&page=${prevPage}`}
            aria-disabled={isFirst}
            tabIndex={isFirst ? -1 : undefined}
            className={`px-3 py-1.5 rounded border text-sm ${
              isFirst
                ? "pointer-events-none opacity-50 border-gray-200 text-gray-400"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Previous
          </Link>
          <Link
            href={`/trades?filter=${filter}&page=${nextPage}`}
            aria-disabled={isLast}
            tabIndex={isLast ? -1 : undefined}
            className={`px-3 py-1.5 rounded border text-sm ${
              isLast
                ? "pointer-events-none opacity-50 border-gray-200 text-gray-400"
                : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  );
}
