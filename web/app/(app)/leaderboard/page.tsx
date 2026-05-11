import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatars } from "@/lib/storage";
import type { LeaderboardEntry } from "@/lib/types";
import { fmtMoney } from "@/lib/format";

export const dynamic = "force-dynamic";

const VALID_MODES = ["quality", "earners"] as const;
type Mode = (typeof VALID_MODES)[number];

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const sp = await searchParams;
  const mode: Mode = VALID_MODES.includes(sp.mode as Mode) ? (sp.mode as Mode) : "quality";

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("get_leaderboard", { mode, lim: 25 });
  const rows = (data ?? []) as LeaderboardEntry[];
  const paths = rows.map((r) => r.avatar_path).filter((p): p is string => !!p);
  const avatars = await signAvatars(paths);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">LEADERBOARD</h1>
        <div className="flex gap-2 text-xs">
          <ModeLink current={mode} target="quality" label="Quality" />
          <ModeLink current={mode} target="earners" label="Earners" />
        </div>
      </div>

      <p className="text-xs text-muted">
        {mode === "quality"
          ? "Ranked by win rate. Auto-verified trades only."
          : "Ranked by total P&L. Auto-verified trades only."}
      </p>

      {error ? (
        <p className="text-sm text-loss">Couldn't load leaderboard: {error.message}</p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-panel p-12 text-center">
          <p className="font-display text-2xl tracking-widest text-gold">NOT ENOUGH DATA</p>
          <p className="mt-2 text-sm text-muted">
            Auto-verified trades required. Connect your broker EA to appear here.
          </p>
        </div>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-panel p-3"
            >
              <span className="w-8 text-center font-display text-xl tracking-widest text-gold">
                {i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `#${i + 1}`}
              </span>
              <div className="h-10 w-10 overflow-hidden rounded-full border border-white/10 bg-black/40">
                {r.avatar_path && avatars[r.avatar_path] ? (
                  <img
                    src={avatars[r.avatar_path]}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/p/${r.id}`}
                  className="block truncate font-medium hover:text-gold"
                >
                  {r.display_name}
                </Link>
                <p className="text-xs text-muted">
                  {r.trade_count} trades · {Math.round(r.win_rate ?? 0)}% WR · {r.avg_rr?.toFixed(2) ?? "—"} avg RR
                  {r.journal_mode === "automated" ? " · 🔵 verified" : ""}
                </p>
              </div>
              <div className="text-right">
                {mode === "earners" ? (
                  <span
                    className={`font-display text-xl tracking-wider tabular-nums ${
                      r.total_pnl >= 0 ? "text-win" : "text-loss"
                    }`}
                  >
                    {fmtMoney(r.total_pnl)}
                  </span>
                ) : (
                  <span className="font-display text-xl tracking-wider tabular-nums text-gold">
                    {Math.round(r.win_rate ?? 0)}%
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function ModeLink({
  current,
  target,
  label,
}: {
  current: Mode;
  target: Mode;
  label: string;
}) {
  const active = current === target;
  return (
    <Link
      href={`/leaderboard?mode=${target}`}
      className={`rounded-md border px-3 py-1 ${
        active
          ? "border-gold/50 text-gold"
          : "border-white/20 text-muted hover:text-white"
      }`}
    >
      {label}
    </Link>
  );
}
