import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Dashboard Analytics" };

export default function DashboardAnalyticsPage() {
  return (
    <article>
      <GuideTitle>Dashboard Analytics</GuideTitle>
      <GuideLead>
        Win rate, total P&amp;L, best pair, average RR, streak — all on
        your Dashboard, recalculated instantly as you log trades.
      </GuideLead>

      <GuideNext href="/guide/advanced-analytics" label="Advanced Analytics" />
    </article>
  );
}
