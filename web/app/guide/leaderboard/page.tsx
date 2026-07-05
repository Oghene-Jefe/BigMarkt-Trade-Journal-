import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideH2,
  GuideTable,
  GuideCallout,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Leaderboard" };

export default function LeaderboardPage() {
  return (
    <article>
      <GuideTitle>Leaderboard</GuideTitle>
      <GuideLead>
        Ranked traders across three tabs: All leaders, Pro traders, Active
        traders.
      </GuideLead>

      <p className="text-sm text-white/80">
        Only auto-verified trades on a live account ever count toward your
        score — manual, demo, and prop-firm trades are excluded entirely.
        This is what keeps the leaderboard trustworthy.
      </p>

      <GuideH2>Eligibility gates — Active tier</GuideH2>
      <p className="text-sm text-white/80">All of the following must be true:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
        <li>At least 30 auto-verified trades</li>
        <li>At least 30 days between your earliest and latest auto-verified trade</li>
        <li>Positive expectancy</li>
        <li>Automated journal mode</li>
        <li>Live account (not demo)</li>
      </ul>

      <GuideH2>Eligibility gates — Pro tier</GuideH2>
      <p className="text-sm text-white/80">Everything above, plus:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
        <li>At least 50 auto-verified trades</li>
        <li>At least 60 days of history</li>
        <li>Max drawdown ≤ 30%</li>
      </ul>

      <GuideH2>Active Score formula (0–100, weighted)</GuideH2>
      <pre className="mt-2 rounded-md border border-white/10 bg-black/40 p-3 text-xs text-white/80 overflow-x-auto">
{`Active Score = Expectancy Score × 0.40
             + Win Rate Score   × 0.25
             + Drawdown Score   × 0.20
             + Regularity Score × 0.15`}
      </pre>

      <GuideH2>Pro Score formula (0–100, weighted — swaps Win Rate for Sortino)</GuideH2>
      <pre className="mt-2 rounded-md border border-white/10 bg-black/40 p-3 text-xs text-white/80 overflow-x-auto">
{`Pro Score = Expectancy Score × 0.35
          + Sortino Score    × 0.30
          + Drawdown Score   × 0.20
          + Regularity Score × 0.15`}
      </pre>

      <GuideH2>Tier assignment</GuideH2>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
        <li><strong>Pro</strong> — eligible for Pro AND Pro Score ≥ 70</li>
        <li><strong>Active</strong> — eligible for Active AND Active Score ≥ 60</li>
        <li>Otherwise you&apos;re tracked internally but not yet ranked</li>
      </ul>

      <GuideH2>How each component is calculated</GuideH2>
      <GuideTable
        headers={["Component", "Formula"]}
        rows={[
          ["Expectancy %", "(average P&L ÷ average absolute P&L) × 100 across all non-breakeven verified trades. Requires at least 2 wins and 2 losses, else 0."],
          ["Expectancy Score", "Linear scale: −20% → 0, 0% → 50, +20% → 100 (clamped 0–100)"],
          ["Win Rate %", "Wins ÷ (Wins + Losses) among verified trades only (breakevens excluded)"],
          ["Win Rate Score", "Equal to win rate % directly (clamped 0–100)"],
          ["Max Drawdown", "Largest peak-to-trough decline on your cumulative P&L curve, plus recovery time in weeks. Requires at least 5 trades."],
          ["Drawdown Score (Active)", "100 − (drawdown % × 2), clamped 0–100"],
          ["Drawdown Score (Pro)", "Duration-weighted: multiplier = min(1 + weeks÷4, 7.5), then 100 − (drawdown % × multiplier × 2)"],
          ["Sortino Ratio", "Mean daily P&L ÷ downside deviation. Requires at least 10 distinct trading days. Zero losing days scores the max (3.0). Clamped to [−1, 10]."],
          ["Sortino Score", "(Sortino ÷ 3.0) × 100, clamped 0–100"],
          ["Regularity", "Coefficient of variation of your weekly trade count over the trailing 90 days"],
          ["Regularity Score", "100 − (CV × 100), clamped 0–100. Fewer than 2 weeks of data scores 0."],
        ]}
      />

      <GuideCallout tone="tip">
        In plain terms: expectancy and drawdown control matter most. A high
        win rate with poor risk management scores worse than a moderate win
        rate with tight, consistent risk control.
      </GuideCallout>

      <GuideNext href="/guide/public-profile" label="Public Profile" />
    </article>
  );
}
