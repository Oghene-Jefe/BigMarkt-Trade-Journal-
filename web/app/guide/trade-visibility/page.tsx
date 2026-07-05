import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideTable,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Trade Visibility" };

export default function TradeVisibilityPage() {
  return (
    <article>
      <GuideTitle>Trade Visibility</GuideTitle>
      <GuideLead>
        Use Private or Exclude for hedges, experiments, or prop-firm
        accounts you don&apos;t want mixed into your main track record.
      </GuideLead>

      <GuideTable
        headers={["Setting", "Effect"]}
        rows={[
          ["Public", "Follows your profile-level visibility"],
          ["Private", "Hidden from everyone — shows only as \"trade logged\" in your count"],
          ["Exclude from Stats", "Doesn't count toward win rate, RR, or leaderboard score"],
        ]}
      />
    </article>
  );
}
