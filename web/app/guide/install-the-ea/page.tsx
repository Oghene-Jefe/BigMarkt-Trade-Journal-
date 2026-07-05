import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideH2,
  GuideSteps,
  GuideCallout,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Install the EA" };

export default function InstallTheEaPage() {
  return (
    <article>
      <GuideTitle>Install the EA</GuideTitle>
      <GuideLead>
        Connecting your MT5 account so trades capture automatically. About
        5 minutes.
      </GuideLead>

      <GuideCallout tone="tip">
        Before you start: confirm your broker supports MT5 and allows
        external EAs — see Broker Compatibility. If you&apos;re on a prop
        firm account, read that warning first.
      </GuideCallout>

      <GuideH2>Step 1 — Download</GuideH2>
      <p className="text-sm text-white/80">
        Go to <strong>EA Setup</strong> and click <strong>Download EA
        (MT5)</strong>. No MetaEditor or coding needed — this is a
        ready-to-use file.
      </p>

      <GuideH2>Step 2 — Install in MT5</GuideH2>
      <GuideSteps
        items={[
          <>Open MT5 &rarr; <strong>File &rarr; Open Data Folder</strong></>,
          <>Navigate to <strong>MQL5 &rarr; Experts</strong></>,
          <>Drag the downloaded <code>.ex5</code> file into that folder</>,
          <>Restart MT5, or press <strong>F5</strong> to refresh the Navigator panel</>,
          <>Find <strong>BigMarkt EA</strong> under Expert Advisors in the Navigator</>,
        ]}
      />

      <GuideCallout tone="tip">
        Make sure AutoTrading is enabled in MT5 (the green play button in
        the toolbar) — the EA needs this to run, even though it never
        places trades itself.
      </GuideCallout>

      <GuideH2>Step 3 — Enter your credentials</GuideH2>
      <p className="text-sm text-white/80">
        Back in <strong>EA Setup</strong>, generate a connection token. Copy
        all 3 values shown into the EA&apos;s input fields when you attach
        it to a chart.
      </p>

      <GuideCallout tone="warning">
        Never share your Signing Secret. It cryptographically signs every
        trade your EA sends to your journal — treat it like a password.
      </GuideCallout>

      <GuideH2>Step 4 — Confirm connection</GuideH2>
      <p className="text-sm text-white/80">
        Place a trade on your connected account (or wait for your next
        one). EA Setup shows a live status: &quot;Waiting for first
        trade...&quot; means installed but nothing captured yet;
        &quot;EA connected — trades are flowing&quot; means you&apos;re
        done. Click Test connection anytime to re-check.
      </p>

      <GuideRelated
        links={[
          { href: "/guide/capture-troubleshooting", label: "Troubleshooting Capture" },
          { href: "/guide/automated-mode-tos", label: "Automated Mode & TOS" },
        ]}
      />
    </article>
  );
}
