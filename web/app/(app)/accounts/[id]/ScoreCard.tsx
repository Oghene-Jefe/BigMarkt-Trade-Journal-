"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { recalculateAccountScore } from "@/lib/actions/scores";
import type { AccountScore } from "@/lib/types";

const TIER_META = {
  pro: { label: "Verified pro", classes: "bg-gold/10 text-gold border-gold/30" },
  active: { label: "Active leader", classes: "bg-win/10 text-win border-win/30" },
  none: { label: "Unranked", classes: "bg-white/5 text-white/60 border-white/10" },
} as const;

const GATE_LABELS: Array<{ key: keyof AccountScore; label: string }> = [
  { key: "gate_min_trades_active", label: "30+ verified trades" },
  { key: "gate_min_days_active", label: "30+ days history" },
  { key: "gate_positive_expectancy", label: "Positive expectancy" },
  { key: "gate_automated_mode", label: "Automated journal mode" },
  { key: "gate_live_account", label: "Live account" },
  { key: "gate_min_trades_pro", label: "50+ verified trades (PRO)" },
  { key: "gate_min_days_pro", label: "60+ days history (PRO)" },
  { key: "gate_max_drawdown_pro", label: "Max drawdown under 30% (PRO)" },
];

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-white/70">
        <span>{label}</span>
        <span className="tabular-nums text-white/90">{value.toFixed(1)}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-white/5">
        <div
          className="h-full rounded-full bg-emerald-500/70"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function ScoreCard({
  accountId,
  score,
}: {
  accountId: string;
  score: AccountScore | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const onRecalculate = () => {
    startTransition(async () => {
      await recalculateAccountScore(accountId);
      router.refresh();
    });
  };

  if (!score) {
    return (
      <div className="rounded-lg border border-white/10 bg-black/30 p-6">
        <h2 className="text-lg font-semibold text-white">Performance Score</h2>
        <p className="mt-1 text-sm text-white/60">
          This account has not been scored yet.
        </p>
        <button
          onClick={onRecalculate}
          disabled={pending}
          className="mt-4 rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50"
        >
          {pending ? "Calculating…" : "Calculate Score"}
        </button>
      </div>
    );
  }

  const tier = TIER_META[score.score_tier];
  const overall =
    score.score_tier === "pro"
      ? score.pro_score
      : score.score_tier === "active"
      ? score.active_score
      : Math.max(score.active_score, score.pro_score);

  return (
    <div className="space-y-6 rounded-lg border border-white/10 bg-black/30 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Performance Score</h2>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${tier.classes}`}
            >
              {tier.label}
            </span>
            <span className="text-4xl font-bold tabular-nums text-white">
              {overall.toFixed(1)}
            </span>
          </div>
        </div>
        <button
          onClick={onRecalculate}
          disabled={pending}
          className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white hover:bg-white/10 disabled:opacity-50"
        >
          {pending ? "Recalculating…" : "Recalculate"}
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3 rounded-md border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-white">Active</h3>
            <span className="tabular-nums text-sm text-white/70">
              {score.active_score.toFixed(1)}
            </span>
          </div>
          <Bar label="Expectancy (40%)" value={score.active_expectancy_score} />
          <Bar label="Win Rate (25%)" value={score.active_winrate_score} />
          <Bar label="Drawdown (20%)" value={score.active_drawdown_score} />
          <Bar label="Regularity (15%)" value={score.active_regularity_score} />
        </div>

        <div className="space-y-3 rounded-md border border-white/5 bg-white/[0.02] p-4">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-white">Verified pro</h3>
            <span className="tabular-nums text-sm text-white/70">
              {score.pro_score.toFixed(1)}
            </span>
          </div>
          <Bar label="Expectancy (35%)" value={score.pro_expectancy_score} />
          <Bar label="Sortino (30%)" value={score.pro_sortino_score} />
          <Bar label="Drawdown (20%)" value={score.pro_drawdown_score} />
          <Bar label="Regularity (15%)" value={score.pro_regularity_score} />
        </div>
      </div>

      <div className="rounded-md border border-white/5 bg-white/[0.02] p-4">
        <h3 className="mb-3 text-sm font-semibold text-white">Eligibility Gates</h3>
        <ul className="grid gap-2 sm:grid-cols-2">
          {GATE_LABELS.map(({ key, label }) => {
            const passed = score[key] as boolean;
            return (
              <li key={key} className="flex items-center gap-2 text-sm">
                {passed ? (
                  <Check size={14} aria-hidden className="text-emerald-400" />
                ) : (
                  <X size={14} aria-hidden className="text-red-400" />
                )}
                <span className="text-white/80">{label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Trades" value={String(score.trade_count)} />
        <Metric label="Win Rate" value={`${score.win_rate_pct.toFixed(1)}%`} />
        <Metric label="Expectancy" value={`${score.expectancy_pct.toFixed(2)}%`} />
        <Metric label="Sortino" value={score.sortino_ratio.toFixed(2)} />
        <Metric label="Max DD" value={`${score.max_drawdown_pct.toFixed(1)}%`} />
        <Metric label="History" value={`${score.account_history_days}d`} />
      </div>

      {score.last_scored_at && (
        <p className="text-xs text-white/40">
          Last scored: {new Date(score.last_scored_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] p-3">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-white">
        {value}
      </div>
    </div>
  );
}
