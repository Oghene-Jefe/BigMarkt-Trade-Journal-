import Link from "next/link";
import type { Route } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { adminDeleteTradeAction } from "../actions";
import ConfirmButton from "@/components/ConfirmButton";
import { fmtMoney, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

type Trade = {
  id: string;
  user_id: string;
  pair: string | null;
  direction: string | null;
  result: string | null;
  pnl: number | null;
  rr_ratio: number | null;
  created_at: string;
  source: string | null;
};

export default async function AdminTradesPage({
  searchParams,
}: {
  searchParams: Promise<{
    pair?: string | string[];
    result?: string | string[];
    user?: string | string[];
    source?: string | string[];
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const pairFilter = (Array.isArray(sp.pair) ? sp.pair[0] : sp.pair) ?? "";
  const resultFilter = (Array.isArray(sp.result) ? sp.result[0] : sp.result) ?? "";
  const userFilter = (Array.isArray(sp.user) ? sp.user[0] : sp.user) ?? "";
  const sourceFilter = (Array.isArray(sp.source) ? sp.source[0] : sp.source) ?? "";

  const sb = await supabaseServer();
  let q = sb
    .from("trades")
    .select("id, user_id, pair, direction, result, pnl, rr_ratio, created_at, source")
    .order("created_at", { ascending: false })
    .limit(100);
  if (pairFilter) q = q.ilike("pair", `%${pairFilter}%`);
  if (resultFilter) q = q.eq("result", resultFilter);
  if (userFilter) q = q.eq("user_id", userFilter);
  if (sourceFilter === "manual") q = q.or("source.eq.manual,source.is.null");
  else if (sourceFilter) q = q.eq("source", sourceFilter);

  const { data } = await q;
  const trades = (data ?? []) as Trade[];

  // Resolve usernames for the visible rows.
  const userIds = Array.from(new Set(trades.map((t) => t.user_id)));
  const profileMap = new Map<string, { username: string | null; display_name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, username, display_name, email")
      .in("id", userIds);
    for (const p of (profiles ?? []) as {
      id: string;
      username: string | null;
      display_name: string | null;
      email: string | null;
    }[]) {
      profileMap.set(p.id, {
        username: p.username,
        display_name: p.display_name,
        email: p.email,
      });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Trade oversight
        </h1>
        <p className="text-xs text-muted">
          Showing {trades.length} most-recent trades across all users.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Pair
          <input
            type="text"
            name="pair"
            defaultValue={pairFilter}
            placeholder="e.g. EURUSD"
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white outline-none focus:border-gold/40"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Result
          <select
            name="result"
            defaultValue={resultFilter}
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
          >
            <option value="">Any</option>
            <option value="WIN">WIN</option>
            <option value="LOSS">LOSS</option>
            <option value="BE">BE</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Source
          <select
            name="source"
            defaultValue={sourceFilter}
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
          >
            <option value="">Any</option>
            <option value="manual">Manual</option>
            <option value="ea">EA</option>
            <option value="metaapi">Cloud</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          User ID
          <input
            type="text"
            name="user"
            defaultValue={userFilter}
            placeholder="uuid"
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white outline-none focus:border-gold/40"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-gold bg-bg px-4 py-1.5 text-xs font-medium text-gold hover:bg-gold hover:text-black"
        >
          FILTER
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Pair</th>
              <th className="px-3 py-2 text-left">Dir</th>
              <th className="px-3 py-2 text-left">Result</th>
              <th className="px-3 py-2 text-left">Source</th>
              <th className="px-3 py-2 text-right">P&amp;L</th>
              <th className="px-3 py-2 text-right">R:R</th>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {trades.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-sm text-muted">
                  No trades match.
                </td>
              </tr>
            ) : (
              trades.map((t) => {
                const p = profileMap.get(t.user_id);
                const display =
                  p?.username || p?.display_name || p?.email?.split("@")[0] || t.user_id.slice(0, 8);
                const suspicious =
                  (t.pnl ?? 0) > 10000 || (t.rr_ratio ?? 0) > 20;
                return (
                  <tr
                    key={t.id}
                    className="border-t border-white/5"
                    style={
                      suspicious
                        ? { boxShadow: "inset 0 0 0 1px #facc15" }
                        : undefined
                    }
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={(p?.username ? `/${p.username}` : `/p/${t.user_id}`) as Route}
                        className="hover:text-gold"
                      >
                        {display}
                      </Link>
                    </td>
                    <td className="px-3 py-2 font-medium">{t.pair ?? "—"}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          t.direction === "BUY" ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                        }`}
                      >
                        {t.direction ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs uppercase ${
                          t.result === "WIN"
                            ? "text-win"
                            : t.result === "LOSS"
                              ? "text-loss"
                              : "text-muted"
                        }`}
                      >
                        {t.result ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {t.source === "ea" ? (
                        <span className="rounded border border-win/30 bg-win/15 px-2 py-0.5 text-xs text-win">EA</span>
                      ) : t.source === "metaapi" ? (
                        <span className="rounded border border-gold/30 bg-gold/15 px-2 py-0.5 text-xs text-gold">Cloud</span>
                      ) : (
                        <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-muted">Manual</span>
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        (t.pnl ?? 0) >= 0 ? "text-win" : "text-loss"
                      }`}
                    >
                      {fmtMoney(t.pnl)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">
                      {t.rr_ratio != null ? t.rr_ratio.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{fmtDate(t.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/journal/${t.id}` as Route}
                          className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5"
                        >
                          View
                        </Link>
                        <form action={adminDeleteTradeAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <ConfirmButton
                            message="Delete this trade as admin? The user will not be notified."
                            className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
                          >
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
