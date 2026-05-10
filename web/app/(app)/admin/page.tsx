import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { fmtMoney, fmtDate } from "@/lib/format";
import { adminDeleteUserAction } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";

export const dynamic = "force-dynamic";

type Overview = {
  total_users: number;
  new_users_week: number;
  new_users_month: number;
  total_trades: number;
  total_pnl: number;
  win_count: number;
  loss_count: number;
  win_rate: number;
  top_pair: string | null;
  top_pair_count: number;
};

type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  source: string | null;
  created_at: string;
  trade_count: number;
  total_pnl: number;
};

type Signup = {
  id: string;
  email: string | null;
  name: string | null;
  source: string | null;
  visibility: string | null;
  created_at: string;
};

type RecentTrade = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  pair: string | null;
  direction: string | null;
  result: string | null;
  pnl: number | null;
  created_at: string;
};

type TopPair = { pair: string; trade_count: number };

export default async function AdminPage() {
  await requireAdmin();
  const sb = await supabaseServer();

  const [overviewRes, usersRes, signupsRes, tradesRes, pairsRes] = await Promise.all([
    sb.rpc("admin_overview"),
    sb.rpc("admin_list_users"),
    sb.rpc("admin_recent_signups", { lim: 10 }),
    sb.rpc("admin_recent_trades", { lim: 10 }),
    sb.rpc("admin_top_pairs", { lim: 7 }),
  ]);

  const overview = (Array.isArray(overviewRes.data) ? overviewRes.data[0] : overviewRes.data) as Overview | null;
  const users = (usersRes.data ?? []) as AdminUser[];
  const signups = (signupsRes.data ?? []) as Signup[];
  const trades = (tradesRes.data ?? []) as RecentTrade[];
  const pairs = (pairsRes.data ?? []) as TopPair[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-widest text-gold">ADMIN</h1>
        <p className="text-xs text-muted">Server-side gated. All reads via SECURITY DEFINER RPCs.</p>
      </div>

      {/* OVERVIEW STATS */}
      {overview ? (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Users" value={String(overview.total_users)} sub={`+${overview.new_users_week} this week · +${overview.new_users_month} this month`} />
          <Stat label="Trades" value={String(overview.total_trades)} sub={`${overview.win_count}W / ${overview.loss_count}L`} />
          <Stat label="Net P&L" value={fmtMoney(overview.total_pnl)} tone={overview.total_pnl >= 0 ? "win" : "loss"} sub={`Win rate ${overview.win_rate}%`} />
          <Stat label="Top Pair" value={overview.top_pair ?? "—"} sub={`${overview.top_pair_count} trades`} />
        </section>
      ) : null}

      {/* USERS TABLE */}
      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-widest text-gold">USERS ({users.length})</h2>
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-panel">
          <table className="w-full text-sm">
            <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Email</th>
                <th className="px-3 py-2 text-left">Source</th>
                <th className="px-3 py-2 text-left">Joined</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">P&amp;L</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-3 py-2 font-medium">{u.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{u.email ?? "—"}</td>
                  <td className="px-3 py-2 text-xs"><span className="rounded bg-white/10 px-2 py-0.5">{u.source ?? "—"}</span></td>
                  <td className="px-3 py-2 text-xs text-muted">{fmtDate(u.created_at)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{u.trade_count}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${u.total_pnl >= 0 ? "text-win" : "text-loss"}`}>
                    {fmtMoney(u.total_pnl)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <form action={adminDeleteUserAction}>
                      <input type="hidden" name="id" value={u.id} />
                      <ConfirmButton
                        message={`Permanently delete ${u.name ?? u.email ?? "this user"} and ALL their trades, charts, balance resets, and challenges? This cannot be undone.`}
                        className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* RECENT SIGNUPS */}
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-widest text-gold">RECENT SIGNUPS</h2>
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-panel text-sm">
            {signups.length === 0 ? (
              <li className="p-4 text-muted">None yet.</li>
            ) : signups.map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <span className="w-24 text-xs text-muted">{fmtDate(s.created_at)}</span>
                <span className="flex-1 truncate">{s.email ?? "—"}</span>
                <span className="text-xs text-muted">{s.source ?? "—"}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* RECENT TRADES */}
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-widest text-gold">RECENT TRADES</h2>
          <ul className="divide-y divide-white/5 rounded-2xl border border-white/10 bg-panel text-sm">
            {trades.length === 0 ? (
              <li className="p-4 text-muted">None yet.</li>
            ) : trades.map((t) => (
              <li key={t.id} className="flex items-center gap-3 p-3">
                <span className="w-20 text-xs text-muted truncate">{t.user_name ?? t.user_email ?? "—"}</span>
                <span className="w-16 text-xs">{t.pair ?? "—"}</span>
                <span className={`w-12 rounded px-2 py-0.5 text-center text-xs ${t.direction === "BUY" ? "bg-win/20 text-win" : "bg-loss/20 text-loss"}`}>
                  {t.direction ?? "—"}
                </span>
                <span className={`flex-1 text-right tabular-nums text-xs ${(t.pnl ?? 0) >= 0 ? "text-win" : "text-loss"}`}>
                  {fmtMoney(t.pnl)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* TOP PAIRS */}
      {pairs.length > 0 ? (
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-widest text-gold">TOP PAIRS</h2>
          <ul className="space-y-1.5 rounded-2xl border border-white/10 bg-panel p-4">
            {pairs.map((p) => {
              const max = pairs[0]?.trade_count || 1;
              const pct = Math.round((p.trade_count / max) * 100);
              return (
                <li key={p.pair} className="flex items-center gap-3 text-sm">
                  <span className="w-20 truncate">{p.pair}</span>
                  <span className="h-2 flex-1 rounded bg-black/30">
                    <span className="block h-full rounded bg-gold/60" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="w-10 text-right tabular-nums text-xs text-muted">{p.trade_count}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "win" | "loss" }) {
  const colour = tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl tracking-wider ${colour}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
    </div>
  );
}
