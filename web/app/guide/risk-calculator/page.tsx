import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideSteps, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Risk Calculator" };

export default function RiskCalculatorPage() {
  return (
    <article>
      <GuideTitle>Risk Calculator</GuideTitle>
      <GuideLead>A position-size calculator for any supported instrument.</GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Risk Calc</strong></>,
          <>Enter account balance, risk %, instrument, entry price, stop price</>,
          <>Read off the calculated lot size, pip value, and max loss</>,
        ]}
      />

      <p className="mt-4 text-sm text-white/80">
        Consistent position sizing is the single biggest lever on your
        Constitution&apos;s max-daily-loss and max-risk rules.
      </p>

      <GuideNext href="/guide/trading-constitution" label="Trading Constitution" />
    </article>
  );
}
