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
