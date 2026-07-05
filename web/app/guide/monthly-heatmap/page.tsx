import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Monthly Heatmap" };

export default function MonthlyHeatmapPage() {
  return (
    <article>
      <GuideTitle>Monthly Heatmap</GuideTitle>
      <GuideLead>
        A color-coded calendar on the Analytics page — each day shaded by
        outcome (big win, small win, loss, break-even, no trade) so you can
        spot patterns at a glance.
      </GuideLead>

      <GuideNext href="/guide/report-cards-export" label="Report Cards & Export" />
    </article>
  );
}
