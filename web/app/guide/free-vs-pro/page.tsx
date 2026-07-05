import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideCallout,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Free vs Pro" };

export default function FreeVsProPage() {
  return (
    <article>
      <GuideTitle>Free vs Pro</GuideTitle>
      <GuideLead>
        BigMarkt Pro is coming soon — not yet billable. Today you can join
        the waitlist from Upgrade.
      </GuideLead>

      <p className="text-sm text-white/80">Planned Pro features:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
        <li>Always-on broker-verified capture (no need to keep MT5 open)</li>
        <li>Multiple connected broker accounts</li>
        <li>Unlimited trade history</li>
        <li>CSV + PDF export</li>
        <li>Public Verified Leader profile</li>
        <li>Advanced analytics</li>
      </ul>

      <GuideCallout tone="tip">
        If you were an early founding leader, your account may already show
        Pro (Founding) — granted at no cost as thanks for helping build the
        platform.
      </GuideCallout>

      <GuideNext href="/guide/referrals" label="Referral Program" />
    </article>
  );
}
