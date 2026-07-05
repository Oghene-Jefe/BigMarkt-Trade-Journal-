import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideSteps,
  GuideTable,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Trading Constitution" };

export default function TradingConstitutionPage() {
  return (
    <article>
      <GuideTitle>Trading Constitution</GuideTitle>
      <GuideLead>
        Your own written trading rules, tracked automatically against your
        logged trades.
      </GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Constitution</strong></>,
          <>Set any combination of rules (see table below)</>,
          <>Choose adherence visibility — private by default</>,
          <>Save</>,
        ]}
      />

      <GuideTable
        headers={["Rule", "Example"]}
        rows={[
          ["Max risk per trade", "1%"],
          ["Require stop loss", "On"],
          ["Max trades per day", "3"],
          ["Allowed instruments", "XAUUSD, EURUSD only"],
          ["Minimum RR", "1:2"],
          ["Max daily loss", "3%"],
          ["Custom rules", "Your own free-text rule"],
        ]}
      />

      <p className="mt-4 text-sm text-white/80">
        Every new trade is checked against your active rules. Your
        adherence score shows how consistently you&apos;re following your
        own plan — a discipline metric, separate from your win rate.
      </p>

      <GuideNext href="/guide/challenges" label="Challenges" />
    </article>
  );
}
