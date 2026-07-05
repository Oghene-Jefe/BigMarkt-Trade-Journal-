import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideSteps, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Report Cards & Export" };

export default function ReportCardsExportPage() {
  return (
    <article>
      <GuideTitle>Report Cards & Export</GuideTitle>
      <GuideLead>Shareable performance summaries and data export.</GuideLead>

      <GuideSteps
        items={[
          <>On <strong>Analytics</strong>, find the Weekly/Monthly Report Card section</>,
          <>Generate a shareable card for the period</>,
          <>Use the export buttons to download as <strong>CSV</strong> or <strong>PDF</strong>, or share the card image directly</>,
        ]}
      />

      <GuideNext href="/guide/discover" label="Discover" />
    </article>
  );
}
