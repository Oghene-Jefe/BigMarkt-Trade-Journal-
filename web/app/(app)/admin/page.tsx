import Link from "next/link";
import type { Route } from "next";
import {
  Users,
  BarChart2,
  MessageSquare,
  Trophy,
  Building2,
  Megaphone,
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
        <h1 className="font-display text-3xl tracking-widest text-gold">
          ADMIN DASHBOARD
        </h1>
        <p className="text-xs text-muted">Last updated {lastUpdated}</p>
      </div>

      <section className="space-y-3">
        <h2 className="border-b border-gold/40 pb-2 font-display text-xl tracking-widest text-gold">
          PLATFORM STATS
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Total Users" value={totalUsers} />
          <Stat label="New Today" value={newToday} />
          <Stat label="Trades Today" value={tradesToday} />
          <Stat label="Trades This Week" value={tradesWeek} />
          <Stat label="All-Time Trades" value={tradesAll} />
          <Stat label="Platform Win Rate" value={`${winRate}%`} />
          <Stat label="Open Support" value={openSupport} />
          <Stat label="Active Brokers" value={activeBrokers} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="border-b border-gold/40 pb-2 font-display text-xl tracking-widest text-gold">
          MANAGEMENT
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
    <div
      className="rounded-2xl border bg-panel p-4"
      style={{ borderColor: "rgba(212,175,55,0.3)" }}
    >
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl tracking-wider text-gold">
        {value}
      </p>
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
      className="group flex items-start gap-3 rounded-2xl border bg-panel p-4 transition hover:border-gold"
      style={{ borderColor: "rgba(212,175,55,0.25)" }}
    >
      <div className="rounded-md bg-gold/10 p-2 text-gold">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-base tracking-widest text-gold">
          {title.toUpperCase()}
        </p>
        <p className="mt-1 text-xs text-muted">{desc}</p>
      </div>
      <span className="self-center text-gold opacity-60 group-hover:opacity-100">
        →
      </span>
    </Link>
  );
}
