import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatar } from "@/lib/storage";
import { fmtDate } from "@/lib/format";
import { ShieldCheck } from "lucide-react";
import TrustBadge from "@/components/TrustBadge";
import FollowButton from "@/components/FollowButton";
import { FollowStats } from "@/components/FollowListModal";
import Link from "next/link";
import type { PublicProfileFull, PublicTrade, Subscription, ScoreTier } from "@/lib/types";
import { chartProxyUrl } from "@/lib/chart-url";
import Logo from "@/components/ui/Logo";
import Avatar from "@/components/ui/Avatar";
import ShareButton from "./ShareButton";
import ReactionPicker from "@/components/ReactionPicker";

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
  const canonical = `https://journal.bigmarkt.co/@${profile.username}`;

  const ogImageUrl = `/api/og?username=${encodeURIComponent(profile.username ?? "")}&name=${encodeURIComponent(profile.display_name)}&trades=${profile.trade_count ?? 0}&wr=${profile.win_rate ?? 0}`;
  const ogImage = { url: ogImageUrl, width: 1200, height: 630, alt: `${profile.display_name}'s verified trading record` };

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "profile", images: [ogImage] },
    twitter: { card: "summary_large_image", title, description, images: [ogImageUrl] },
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

  const [{ data: tradesData }, { data: adherenceData }, { data: scoreData }] = await Promise.all([
    sb.rpc("get_public_trades", { profile_id: profile.id, lim: 50 }),
    sb.rpc("get_public_adherence", { profile_id: profile.id }),
    sb.rpc("get_public_score", { p_profile_id: profile.id }),
  ]);

  const trades = (tradesData ?? []) as PublicTrade[];

  type PublicScore = {
    score_tier: ScoreTier;
    active_score: number | null;
    pro_score: number | null;
    trade_count: number | null;
    win_rate_pct: number | null;
    expectancy_pct: number | null;
    max_drawdown_pct: number | null;
    last_scored_at: string | null;
  };
  const scoreRow = (Array.isArray(scoreData) ? scoreData[0] : scoreData) as PublicScore | null;
  const score = scoreRow?.score_tier && scoreRow.score_tier !== "none" ? scoreRow : null;

  // Public adherence trust signal — only when opted in AND evaluated>0.
  const adherenceRow = (
    Array.isArray(adherenceData) ? adherenceData[0] : adherenceData
  ) as { pct: number | null; evaluated: number; clean: number } | null;
  const adherence =
    adherenceRow && adherenceRow.pct != null && adherenceRow.evaluated > 0
      ? adherenceRow
      : null;
  const avatarUrl = profile.avatar_path ? await signAvatar(profile.avatar_path) : null;

  const { data: followCounts } = await sb.rpc("get_follow_counts", {
    profile_id: profile.id,
  });
  const fc = (followCounts as { followers?: number; following?: number }) ?? {};
  const followers = fc.followers ?? 0;
  const following = fc.following ?? 0;

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
          <Avatar url={avatarUrl} name={profile.display_name} size="lg" />
          <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-white truncate">
                {profile.display_name}
              </h1>
              <p className="text-xs uppercase tracking-wider text-muted">
                @{profile.username} · {profile.visibility}
              </p>
              {score ? (
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] ${
                      score.score_tier === "pro"
                        ? "border-gold/40 bg-gold/15 text-gold"
                        : "border-white/15 bg-white/5 text-muted"
                    }`}
                  >
                    {score.score_tier === "pro" ? "Verified Pro" : "Active Trader"}
                  </span>
                </div>
              ) : null}
              {journalModeLabel ? (
                <p className="mt-1 text-xs text-gold">{journalModeLabel}</p>
              ) : null}
            </div>
            <ShareButton url={`https://journal.bigmarkt.co/@${profile.username}`} />
          </div>
        </div>

        <div className="mt-4">
          <FollowStats profileId={profile.id} followers={followers} following={following} />
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

        {score ? (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat
              label="Expectancy"
              value={
                score.expectancy_pct != null && Number.isFinite(score.expectancy_pct)
                  ? `${Number(score.expectancy_pct).toFixed(2)}%`
                  : "—"
              }
              tone={
                score.expectancy_pct != null && score.expectancy_pct >= 0 ? "win" : "loss"
              }
            />
            <Stat
              label="Max DD"
              value={
                score.max_drawdown_pct != null && Number.isFinite(score.max_drawdown_pct)
                  ? `${Number(score.max_drawdown_pct).toFixed(1)}%`
                  : "—"
              }
              tone="loss"
            />
          </div>
        ) : null}

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
                {t.chart_path ? (
                  <a href={chartProxyUrl(t.id, t.chart_path)} target="_blank" rel="noopener">
                    {/* eslint-disable-next-line @next/next/no-img-element -- same-origin /c/<id> chart proxy */}
                    <img
                      src={chartProxyUrl(t.id, t.chart_path)}
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
                <span className="flex-1 text-right tabular-nums">
                  {t.rr_ratio != null ? (
                    <span className={t.rr_ratio > 0 ? "text-win" : t.rr_ratio < 0 ? "text-loss" : "text-muted"}>
                      {t.rr_ratio > 0 ? "+" : ""}{t.rr_ratio.toFixed(2)}R
                    </span>
                  ) : (
                    <span className={t.result === "WIN" ? "text-win" : t.result === "LOSS" ? "text-loss" : "text-muted"}>
                      {t.result ?? "—"}
                    </span>
                  )}
                </span>
                <TrustBadge badge={t.trust_badge ?? "manual"} />
                <div className="mt-1 w-full border-t border-white/5 pt-2">
                  <ReactionPicker tradeId={t.id} />
                </div>
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
