import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideTable,
  GuideCallout,
  GuideSteps,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Log a Trade" };

export default function LogATradePage() {
  return (
    <article>
      <GuideTitle>Log a Trade</GuideTitle>
      <GuideLead>Manually recording a trade.</GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Journal &rarr; New Trade</strong></>,
          <>Fill in the fields (see table below)</>,
          <>Optionally attach a chart screenshot</>,
          <>Set this trade&apos;s visibility</>,
          <>Click <strong>Save Trade</strong></>,
        ]}
      />

      <GuideTable
        headers={["Field", "Notes"]}
        rows={[
          ["Pair", "e.g. XAUUSD, EURUSD"],
          ["Direction", "Buy / Sell"],
          ["Entry / Exit price", ""],
          ["Stop Loss / Take Profit", ""],
          ["Lot Size", ""],
          ["Result", "Win / Loss / Break-even"],
          ["RR Ratio & P&L", "Auto-calculated on save"],
          ["Setup Grade", "A+ to D — your own execution rating"],
          ["Session", "Which session you traded"],
          ["Emotions", "Feeds your Psychology Advisor"],
          ["Strategy / Tags", "Free-form, for your own filtering"],
          ["Trade Thesis", "Your public rationale — separate from private Notes, visible on your profile if the trade is public"],
          ["Notes", "Private, never shown publicly"],
        ]}
      />

      <GuideCallout tone="tip">
        Manually logged trades carry a <strong>Manual</strong> trust badge —
        self-reported, fully editable, not counted on the leaderboard.
      </GuideCallout>

      <GuideRelated
        links={[
          { href: "/guide/how-verification-works", label: "How Verification Works" },
          { href: "/guide/trade-visibility", label: "Trade Visibility" },
        ]}
      />
    </article>
  );
}
