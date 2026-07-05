import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideSteps,
  GuideTable,
  GuideCallout,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Broker Compatibility" };

export default function BrokerCompatibilityPage() {
  return (
    <article>
      <GuideTitle>Broker Compatibility</GuideTitle>
      <GuideLead>
        Which brokers work with the EA, and what to check before
        connecting.
      </GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Broker Guide</strong></>,
          <>Filter by category (Forex, Crypto, Futures, Stocks, Prop Firm) or status</>,
          <>Check each broker&apos;s status</>,
        ]}
      />

      <GuideTable
        headers={["Status", "Meaning"]}
        rows={[
          ["Supported", "Full MT5 + EA compatibility confirmed"],
          ["Partial", "Works with caveats — read the notes"],
          ["Unsupported", "No MT4/MT5, or EA explicitly restricted"],
          ["Inactive", "Listed for reference, not currently recommended"],
        ]}
      />

      <p className="text-sm text-white/80">
        Don&apos;t see your broker? Use the unlisted broker checker, or
        submit it for review — both are on the Broker Guide page.
      </p>

      <GuideCallout tone="warning">
        Prop firm accounts: most prop firms explicitly restrict third-party
        EAs or copy-signal behavior on funded accounts. BigMarkt
        automatically locks any account marked &quot;Prop Firm&quot; to
        journal-only mode. Always confirm your specific firm&apos;s terms
        before connecting a funded account.
      </GuideCallout>

      <GuideNext href="/guide/automated-mode-tos" label="Automated Mode & TOS" />
    </article>
  );
}
