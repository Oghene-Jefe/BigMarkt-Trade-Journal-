import Link from "next/link";
import type { Route } from "next";
import {
  Users,
  BarChart2,
  MessageSquare,
  Trophy,
  Building2,
  Megaphone,
  ArrowRight,
} from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { fmtMoney, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function startOfWeekIso(): string {
  const d = new Date();
  const day = d.getDay();
  const offsetToMonday = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetToMonday);
  return d.toISOString();
}

async function safeCount(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  table: string,
  modifier?: (q: ReturnType<typeof sb.from>) => unknown,
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = sb.from(table).select("*", { count: "exact", head: true });
  if (modifier) q = modifier(q);
  const { count, error } = await q;
  if (error) return 0;
  return count ?? 0;
}

type SignupRow = {
  id: string;
  email: string | null;
  name: string | null;
  source: string | null;
  visibility: string | null;
  created_at: string | null;
};

type RecentTradeRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  pair: string | null;
  direction: string | null;
  result: string | null;
  pnl: number | null;
  created_at: string | null;
};

type TopPairRow = {
  pair: string | null;
  trade_count: number | null;
};

function displayName(name: string | null, email: string | null): string {
  if (name && name.trim()) return name;
  if (email) return email.split("@")[0];
  return "—";
}

export default async function AdminPage() {
  await requireAdmin();
  const sb = await supabaseServer();

  const todayIso = startOfTodayIso();
  const weekIso = startOfWeekIso();

  const [
    totalUsers,
    newToday,
    tradesToday,
    tradesWeek,
    tradesAll,
    winCount,
    closedCount,
    openSupport,
    activeBrokers,
  ] = await Promise.all([
    safeCount(sb, "profiles"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeCount(sb, "profiles", (q: any) => q.gte("created_at", todayIso)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeCount(sb, "trades", (q: any) => q.gte("created_at", todayIso)),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeCount(sb, "trades", (q: any) => q.gte("created_at", weekIso)),
    safeCount(sb, "trades"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeCount(sb, "trades", (q: any) => q.eq("result", "WIN")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeCount(sb, "trades", (q: any) => q.in("result", ["WIN", "LOSS"])),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeCount(sb, "support_conversations", (q: any) => q.eq("status", "open")),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    safeCount(sb, "brokers", (q: any) => q.eq("is_active", true)),
  ]);

  const winRate = closedCount > 0 ? Math.round((winCount / closedCount) * 100) : 0;
  const lastUpdated = new Date().toLocaleString();

  // Admin-only RPCs (each SECURITY DEFINER + is_admin gated). Fetched
  // independently so one failing section never throws the whole page —
  // defense-in-depth, mirroring the sb.rpc(...) pattern in lib/admin.ts.
  const [signupsRes, recentTradesRes, topPairsRes] = await Promise.all([
    sb.rpc("admin_recent_signups", { lim: 10 }),
    sb.rpc("admin_recent_trades", { lim: 10 }),
    sb.rpc("admin_top_pairs", { lim: 7 }),
  ]);

  const signups = (signupsRes.data ?? []) as SignupRow[];
  const signupsError = signupsRes.error;
  const recentTrades = (recentTradesRes.data ?? []) as RecentTradeRow[];
  const recentTradesError = recentTradesRes.error;
  const topPairs = (topPairsRes.data ?? []) as TopPairRow[];
  const topPairsError = topPairsRes.error;
  const maxPairCount = topPairs.reduce(
    (m, p) => Math.max(m, p.trade_count ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-white">Admin dashboard</h1>
        <p className="mt-1 text-xs text-muted">Last updated {lastUpdated}</p>
      </div>

      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-sm font-medium text-white">
          Platform stats
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Total users" value={totalUsers} />
          <Stat label="New today" value={newToday} />
          <Stat label="Trades today" value={tradesToday} />
          <Stat label="Trades this week" value={tradesWeek} />
          <Stat label="All-time trades" value={tradesAll} />
          <Stat label="Platform win rate" value={`${winRate}%`} />
          <Stat label="Open support" value={openSupport} />
          <Stat label="Active brokers" value={activeBrokers} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-sm font-medium text-white">
          Management
        </h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ManageCard
            href={"/admin/users" as Route}
            icon={<Users className="h-5 w-5" />}
            title="Users"
            desc="Manage user accounts, ban / unban, view trade history."
          />
          <ManageCard
            href={"/admin/trades" as Route}
            icon={<BarChart2 className="h-5 w-5" />}
            title="Trades"
            desc="Review and moderate trades across the platform."
          />
          <ManageCard
            href={"/admin/support" as Route}
            icon={<MessageSquare className="h-5 w-5" />}
            title="Support"
            desc="View support conversations and reply to users."
          />
          <ManageCard
            href={"/admin/leaderboard" as Route}
            icon={<Trophy className="h-5 w-5" />}
            title="Leaderboard"
            desc="Set score overrides and ban users from the board."
          />
          <ManageCard
            href={"/admin/brokers" as Route}
            icon={<Building2 className="h-5 w-5" />}
            title="Brokers"
            desc="Add, edit, and toggle broker listings."
          />
          <ManageCard
            href={"/admin/broadcast" as Route}
            icon={<Megaphone className="h-5 w-5" />}
            title="Broadcast"
            desc="Send announcements to all users or a single user."
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-sm font-medium text-white">
          Recent signups
        </h2>
        {signupsError ? (
          <p className="text-xs text-loss">Couldn&apos;t load recent signups.</p>
        ) : signups.length === 0 ? (
          <p className="text-xs text-muted">No signups yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
            <table className="w-full text-sm">
              <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-left">Joined</th>
                </tr>
              </thead>
              <tbody>
                {signups.map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-medium text-white">
                      {displayName(s.name, s.email)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{s.email ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{s.source ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{fmtDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-sm font-medium text-white">
          Recent trades
        </h2>
        {recentTradesError ? (
          <p className="text-xs text-loss">Couldn&apos;t load recent trades.</p>
        ) : recentTrades.length === 0 ? (
          <p className="text-xs text-muted">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-white/10 bg-panel">
            <table className="w-full text-sm">
              <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Pair</th>
                  <th className="px-3 py-2 text-left">Direction</th>
                  <th className="px-3 py-2 text-left">Result</th>
                  <th className="px-3 py-2 text-right">P&amp;L</th>
                  <th className="px-3 py-2 text-left">When</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t) => (
                  <tr key={t.id} className="border-t border-white/5">
                    <td className="px-3 py-2 font-medium text-white">
                      {displayName(t.user_name, t.user_email)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{t.pair ?? "—"}</td>
                    <td className="px-3 py-2 text-xs uppercase text-muted">
                      {t.direction ?? "—"}
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
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        (t.pnl ?? 0) >= 0 ? "text-win" : "text-loss"
                      }`}
                    >
                      {fmtMoney(t.pnl)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{fmtDate(t.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-white/10 pb-2 text-sm font-medium text-white">
          Top pairs
        </h2>
        {topPairsError ? (
          <p className="text-xs text-loss">Couldn&apos;t load top pairs.</p>
        ) : topPairs.length === 0 ? (
          <p className="text-xs text-muted">No pairs yet.</p>
        ) : (
          <div className="space-y-2 rounded-lg border border-white/10 bg-panel p-4">
            {topPairs.map((p, i) => {
              const count = p.trade_count ?? 0;
              const pct = maxPairCount > 0 ? (count / maxPairCount) * 100 : 0;
              return (
                <div key={`${p.pair ?? "unknown"}-${i}`} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-sm text-white">
                    {p.pair ?? "—"}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded bg-white/5">
                    <div
                      className="h-full rounded bg-gold"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-white/10 bg-panel p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function ManageCard({
  href,
  icon,
  title,
  desc,
}: {
  href: Route;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-lg border border-white/10 bg-panel p-4 transition hover:border-gold/40"
    >
      <div className="rounded-md bg-gold/10 p-2 text-gold">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium text-white">{title}</p>
        <p className="mt-1 text-xs text-muted">{desc}</p>
      </div>
      <ArrowRight
        size={14}
        aria-hidden
        className="mt-1 shrink-0 text-muted group-hover:text-gold"
      />
    </Link>
  );
}
