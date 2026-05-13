import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type LeaderRow = {
  user_id: string;
  display_name: string | null;
  avatar_path: string | null;
  trade_count: number | null;
  win_rate: number | null;
  total_pnl: number | null;
  growth_pct: number | null;
  quality_score: number | null;
  badges: string[] | null;
};

type PlatformStats = {
  total_traders: number | null;
  auto_verified_trades: number | null;
  public_leaders: number | null;
};

function initials(name: string | null): string {
  const n = (name ?? "Trader").trim();
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "T";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function fmtCount(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect("/dashboard");

  const [{ data: statsRows }, { data: leaderRows }] = await Promise.all([
    sb.rpc("get_platform_stats"),
    sb.rpc("get_leaderboard", { mode: "quality", lim: 3 }),
  ]);

  const stats: PlatformStats =
    (Array.isArray(statsRows) ? statsRows[0] : statsRows) ?? {
      total_traders: null,
      auto_verified_trades: null,
      public_leaders: null,
    };
  const leaders = (leaderRows ?? []) as LeaderRow[];

  return (
    <main className="min-h-screen bg-bg text-white">
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="flex min-h-screen flex-col items-center justify-center px-4 py-12 text-center">
        <h1 className="font-display text-4xl leading-tight tracking-wider sm:text-6xl">
          <span className="block">The Verified</span>
          <span className="block text-gold">Trading Journal.</span>
          <span className="block text-muted">Your reputation. On-chain.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted sm:text-lg">
          Auto-capture every trade from your broker. Build a verified public record.
          Follow the best traders in the world.
        </p>
        <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="rounded-md bg-gold px-6 py-3 text-center font-display tracking-widest text-black hover:bg-gold/90 sm:w-auto"
          >
            START FREE
          </Link>
          <Link
            href="/leaderboard"
            className="rounded-md border border-gold px-6 py-3 text-center font-display tracking-widest text-gold hover:bg-gold/10 sm:w-auto"
          >
            SEE THE LEADERBOARD
          </Link>
        </div>
        <p className="mt-10 text-xs uppercase tracking-[0.25em] text-muted">
          <span className="text-white">{fmtCount(stats.total_traders)}</span> verified traders
          <span className="mx-2 text-muted/50">•</span>
          <span className="text-white">{fmtCount(stats.auto_verified_trades)}</span> auto-captured trades
          <span className="mx-2 text-muted/50">•</span>
          <span className="text-white">{fmtCount(stats.public_leaders)}</span> public leaders
        </p>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl tracking-wider text-gold sm:text-4xl">
            Not self-reported. Verified.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <FeatureCard
              icon="🔵"
              title="Auto-Verified"
              body="Your MT4/MT5 EA captures every trade in real time. Immutable. Timestamped. Locked."
            />
            <FeatureCard
              icon="📊"
              title="Public Leaderboard"
              body="Ranked by real performance. Win rate, expectancy, drawdown. No screenshots accepted."
            />
            <FeatureCard
              icon="🔔"
              title="Follow Top Traders"
              body="Subscribe to verified leaders. Signals delivered to your journal. Copy execution coming in Phase 3."
            />
          </div>
        </div>
      </section>

      {/* ── Leaderboard preview ──────────────────────────────────────── */}
      <section className="border-t border-white/10 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl tracking-wider text-gold sm:text-4xl">
            The verified leaderboard. Live.
          </h2>
          {leaders.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-white/10 bg-panel px-6 py-10 text-center">
              <p className="text-muted">
                Leaderboard fills as traders connect their brokers. Be one of the first.
              </p>
              <Link
                href="/signup"
                className="mt-5 inline-block rounded-md bg-gold px-5 py-2 font-display tracking-widest text-black hover:bg-gold/90"
              >
                START FREE
              </Link>
            </div>
          ) : (
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
              {leaders.map((l, idx) => (
                <LeaderCard key={l.user_id} rank={idx + 1} leader={l} />
              ))}
            </div>
          )}
          <div className="mt-8 text-center">
            <Link href="/leaderboard" className="text-sm text-gold hover:underline">
              View Full Leaderboard →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Ecosystem ────────────────────────────────────────────────── */}
      <section className="border-t border-white/10 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-display text-3xl tracking-wider text-gold sm:text-4xl">
            The BigMarkt Ecosystem
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <EcoCard
              href="/"
              domain="journal.bigmarkt.co"
              title="The Journal"
              body="Verify your trades"
              internal
            />
            <EcoCard
              href="https://bigmarkt.co"
              domain="bigmarkt.co"
              title="The Protocol"
              body="The full vision"
            />
            <EcoCard
              href="https://club.bigmarkt.co"
              domain="club.bigmarkt.co"
              title="The Campus Club"
              body="For student traders"
            />
            <EcoCard
              href="https://fts.bigmarkt.co"
              domain="fts.bigmarkt.co"
              title="The Academy"
              body="Learn to trade"
            />
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 bg-panel px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="font-display text-2xl tracking-widest text-gold">BIGMARKT</p>
              <p className="mt-1 text-xs uppercase tracking-[0.3em] text-muted">
                Trade. Verify. Earn.
              </p>
            </div>
            <nav className="flex flex-wrap gap-4 text-sm text-muted">
              <Link href="/signup" className="hover:text-white">Sign Up</Link>
              <Link href="/login" className="hover:text-white">Log In</Link>
              <Link href="/leaderboard" className="hover:text-white">Leaderboard</Link>
              <Link href="/brokers" className="hover:text-white">Broker Guide</Link>
            </nav>
          </div>
          <p className="mt-8 text-xs leading-relaxed text-muted">
            Trading involves substantial risk of loss. Past performance is not indicative of
            future results. BigMarkt is a journaling and transparency tool, not a financial
            advisor.
          </p>
          <p className="mt-4 text-xs text-muted/70">© 2026 BigMarkt Protocol</p>
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-6">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <h3 className="mt-3 font-display text-xl tracking-wider text-white">{title}</h3>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}

function LeaderCard({ rank, leader }: { rank: number; leader: LeaderRow }) {
  const name = leader.display_name ?? "Trader";
  const winRate = leader.win_rate != null ? `${Number(leader.win_rate).toFixed(0)}%` : "—";
  const quality = leader.quality_score != null ? Number(leader.quality_score).toFixed(0) : "—";
  const topBadge = leader.badges && leader.badges.length > 0 ? leader.badges[0] : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-5">
      <div className="flex items-center gap-3">
        <span className="font-display text-2xl text-gold">#{rank}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/20 font-display text-sm tracking-wider text-gold">
          {initials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-white">{name}</p>
          {topBadge ? (
            <p className="truncate text-xs uppercase tracking-wider text-gold/80">{topBadge}</p>
          ) : null}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Stat label="Score" value={quality} />
        <Stat label="Win" value={winRate} />
        <Stat label="Trades" value={String(leader.trade_count ?? 0)} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-1 truncate font-display text-lg text-white">{value}</dd>
    </div>
  );
}

function EcoCard({
  href,
  domain,
  title,
  body,
  internal,
}: {
  href: string;
  domain: string;
  title: string;
  body: string;
  internal?: boolean;
}) {
  const className =
    "block rounded-2xl border border-white/10 bg-panel p-5 hover:border-gold/40";
  const inner = (
    <>
      <p className="text-xs uppercase tracking-wider text-muted">{domain}</p>
      <p className="mt-2 font-display text-lg tracking-wider text-gold">{title}</p>
      <p className="mt-1 text-sm text-muted">{body}</p>
    </>
  );
  if (internal) {
    return <Link href={href} className={className}>{inner}</Link>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {inner}
    </a>
  );
}
