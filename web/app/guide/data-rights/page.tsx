import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Your Data Rights" };

export default function DataRightsPage() {
  return (
    <article>
      <GuideTitle>Your Data Rights</GuideTitle>
      <GuideLead>
        You can request full account and data deletion at any time —
        contact support to start this.
      </GuideLead>

      <GuideNext href="/guide/faq" label="FAQ" />
    </article>
  );
}
