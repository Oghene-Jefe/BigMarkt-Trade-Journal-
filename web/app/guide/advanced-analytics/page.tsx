import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideTable,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Advanced Analytics" };

export default function AdvancedAnalyticsPage() {
  return (
    <article>
      <GuideTitle>Advanced Analytics</GuideTitle>
      <GuideLead>Deeper breakdowns, all on the Analytics page.</GuideLead>

      <GuideTable
        headers={["Chart", "Shows"]}
        rows={[
          ["Equity Curve", "Cumulative performance over time"],
          ["Drawdown", "Peak-to-trough decline over time"],
          ["Win Rate by Pair", "Which instruments you actually perform best on"],
          ["Session Breakdown", "Performance by trading session"],
          ["Setup Grade", "Performance by your own A+–D grading"],
          ["Psychology Advisor", "Surfaces patterns from your logged emotions and tags — e.g. which emotional states correlate with your worst trades"],
        ]}
      />

      <GuideRelated
        links={[
          { href: "/guide/monthly-heatmap", label: "Monthly Heatmap" },
          { href: "/guide/report-cards-export", label: "Report Cards & Export" },
        ]}
      />
    </article>
  );
}
