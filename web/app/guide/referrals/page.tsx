import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Referral Program" };

export default function ReferralsPage() {
  return (
    <article>
      <GuideTitle>Referral Program</GuideTitle>
      <GuideLead>
        Find your referral code and link on Profile. Anyone who signs up
        through your link is tracked against your account. There&apos;s no
        reward mechanic live yet — this will expand in a future release.
      </GuideLead>

      <GuideNext href="/guide/security-model" label="Security Model" />
    </article>
  );
}
