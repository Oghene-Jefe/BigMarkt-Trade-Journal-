import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatar, signCharts } from "@/lib/storage";
import { fmtMoney, fmtDate } from "@/lib/format";
import { ShieldCheck } from "lucide-react";
import TrustBadge from "@/components/TrustBadge";
import FollowButton from "@/components/FollowButton";
import Link from "next/link";
import type { PublicProfileFull, PublicTrade, Subscription } from "@/lib/types";
import Logo from "@/components/ui/Logo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const sb = await supabaseServer();
  const { data: profileData } = await sb.rpc("get_profile_by_username", {
    slug: username,
  });
  const profile = (
    Array.isArray(profileData) ? profileData[0] : profileData
  ) as PublicProfileFull | null;
  if (!profile) return {};

  const title = `${profile.display_name}'s Trading Journal`;
  const description = `Browse @${profile.username}'s read-only trading journal on BigMarkt — verified trades, win rate, and performance stats.`;
  const canonical = `/@${profile.username}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

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

  const [{ data: tradesData }, { data: adherenceData }] = await Promise.all([
    sb.rpc("get_public_trades", { profile_id: profile.id, lim: 50 }),
    sb.rpc("get_public_adherence", { profile_id: profile.id }),
  ]);

  const trades = (tradesData ?? []) as PublicTrade[];

  // Public adherence trust signal — only when opted in AND evaluated>0.
  const adherenceRow = (
    Array.isArray(adherenceData) ? adherenceData[0] : adherenceData
  ) as { pct: number | null; evaluated: number; clean: number } | null;
  const adherence =
    adherenceRow && adherenceRow.pct != null && adherenceRow.evaluated > 0
      ? adherenceRow
      : null;
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
    ? "Auto-verified journal"
    : null;

  const profileJsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: profile.display_name,
      alternateName: `@${profile.username}`,
      url: `https://journal.bigmarkt.co/@${profile.username}`,
    },
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <script
        type="application/ld+json"
        // Built from public profile fields; escape "<" so a crafted
        // display_name can't break out of the <script> context.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(profileJsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <header className="mb-8 flex items-center justify-between">
        <Link href="/">
          <Logo size="md" />
        </Link>
        <Link href="/leaderboard" className="text-xs text-muted hover:text-white">
          Leaderboard →
        </Link>
      </header>

      <section className="rounded-lg border border-white/10 bg-panel p-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 overflow-hidden rounded-full border border-white/10 bg-black/40">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, re-issued per render
              <img src={avatarUrl} alt={profile.display_name} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-white truncate">
              {profile.display_name}
            </h1>
            <p className="text-xs uppercase tracking-wider text-muted">
              @{profile.username} · {profile.visibility}
            </p>
            {journalModeLabel ? (
              <p className="mt-1 text-xs text-gold">{journalModeLabel}</p>
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

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Stat label="Trades" value={String(profile.trade_count ?? 0)} />
          <Stat
            label="Win Rate"
            value={`${Math.round(profile.win_rate ?? 0)}%`}
            tone={(profile.win_rate ?? 0) >= 50 ? "win" : "loss"}
          />
        </div>

        {adherence ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-gold/30 bg-gold/5 px-3 py-2 text-xs text-gold">
            <ShieldCheck size={14} aria-hidden />
            <span>
              Follows their own rules{" "}
              <span className="font-semibold">{adherence.pct}%</span> ·{" "}
              {adherence.clean}/{adherence.evaluated} trades
            </span>
          </div>
        ) : null}
      </section>

      <section className="mt-6 space-y-3">
        <h2 className="text-sm font-medium text-white">Public trades</h2>
        {trades.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-panel p-8 text-center">
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
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, re-issued per render */}
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
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${colour}`}>{value}</p>
    </div>
  );
}
