import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatar, signCharts } from "@/lib/storage";
import { fmtMoney, fmtDate } from "@/lib/format";
import TrustBadge from "@/components/TrustBadge";
import FollowButton from "@/components/FollowButton";
import Link from "next/link";
import type { PublicProfileFull, PublicTrade, Subscription } from "@/lib/types";
import Logo from "@/components/ui/Logo";

export const dynamic = "force-dynamic";

export default async function UsernameProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const sb = await supabaseServer();

  const { data: profileData } = await sb.rpc("get_profile_by_username", {
    slug: username,
  });

  const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as PublicProfileFull | null;
  if (!profile) notFound();

  const { data: tradesData } = await sb.rpc("get_public_trades", {
    profile_id: profile.id,
    lim: 50,
  });

  const trades = (tradesData ?? []) as PublicTrade[];
  const avatarUrl = profile.avatar_path ? await signAvatar(profile.avatar_path) : null;
  const chartPaths = trades.map((t) => t.chart_path).filter((p): p is string => !!p);
  const chartUrls = await signCharts(chartPaths);

  const {
    data: { user },
  } = await sb.auth.getUser();
  const currentUserId = user?.id ?? null;

  let existingSubscription: Subscription | null = null;
  if (currentUserId && currentUserId !== profile.id) {
    const { data: subRow } = await sb
      .from("subscriptions")
      .select("*")
      .eq("follower_id", currentUserId)
      .eq("leader_id", profile.id)
      .neq("status", "cancelled")
      .maybeSingle();
    existingSubscription = (subRow as Subscription | null) ?? null;
  }

  const journalModeLabel = profile.journal_mode === "automated"
    ? "🔵 AUTO-VERIFIED JOURNAL"
    : null;

  return (
    <main className="mx-auto max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/">
          <Logo size="md" />
        </Link>
        <Link href="/leaderboard" className="text-xs text-muted hover:text-white">
          Leaderboard →
        </Link>
      </header>

      <section className="rounded-2xl border border-white/10 bg-panel p-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-black/40">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl tracking-widest text-gold truncate">
              {profile.display_name}
            </h1>
            <p className="text-xs uppercase tracking-wider text-muted">
              @{profile.username} · {profile.visibility}
            </p>
            {journalModeLabel ? (
              <p className="mt-1 text-xs font-mono text-blue-400">{journalModeLabel}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-5">
          <FollowButton
            leaderId={profile.id}
            leaderUsername={profile.username}
            currentUserId={currentUserId}
            existingSubscription={existingSubscription}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          <Stat label="Trades" value={String(profile.trade_count ?? 0)} />
          <Stat
            label="Win Rate"
            value={`${Math.round(profile.win_rate ?? 0)}%`}
            tone={(profile.win_rate ?? 0) >= 50 ? "win" : "loss"}
          />
          <Stat
            label="Net P&L"
            value={fmtMoney(profile.total_pnl)}
            tone={(profile.total_pnl ?? 0) >= 0 ? "win" : "loss"}
          />
        </div>
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="font-display text-xl tracking-widest text-gold">PUBLIC TRADES</h2>
        {trades.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-panel p-8 text-center">
            <p className="text-sm text-muted">No public trades yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {trades.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-panel p-3"
              >
                <span className="w-24 text-xs text-muted">{fmtDate(t.created_at)}</span>
                {t.chart_path && chartUrls[t.chart_path] ? (
                  <a href={chartUrls[t.chart_path]} target="_blank" rel="noreferrer">
                    <img
                      src={chartUrls[t.chart_path]}
                      alt=""
                      className="h-10 w-14 rounded object-cover"
                      loading="lazy"
                    />
                  </a>
                ) : (
                  <span className="h-10 w-14 rounded bg-black/30" />
                )}
                <span className="w-20 font-medium">{t.pair ?? "—"}</span>
                <span
                  className={`w-12 rounded px-2 py-0.5 text-center text-xs ${
                    t.direction === "BUY" ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                  }`}
                >
                  {t.direction ?? "—"}
                </span>
                <span
                  className={`w-14 text-xs uppercase ${
                    t.result === "WIN"
                      ? "text-win"
                      : t.result === "LOSS"
                      ? "text-loss"
                      : "text-muted"
                  }`}
                >
                  {t.result ?? "—"}
                </span>
                <span
                  className={`flex-1 text-right tabular-nums ${
                    (t.pnl ?? 0) >= 0 ? "text-win" : "text-loss"
                  }`}
                >
                  {fmtMoney(t.pnl)}
                </span>
                <TrustBadge badge={t.trust_badge ?? "manual"} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-center text-xs text-muted">
        BigMarkt · public profiles never expose email addresses
      </p>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "win" | "loss";
}) {
  const colour =
    tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : "text-white";
  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl tracking-wider ${colour}`}>{value}</p>
    </div>
  );
}
