import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideSteps,
  GuideCallout,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Chart Screenshots" };

export default function ChartScreenshotsPage() {
  return (
    <article>
      <GuideTitle>Chart Screenshots</GuideTitle>
      <GuideLead>Attaching a chart image to a trade entry.</GuideLead>

      <GuideSteps
        items={[
          <>On the trade form, click <strong>Upload Chart</strong></>,
          <>Choose a JPG/PNG up to 5MB — compressed automatically</>,
          <>Save</>,
        ]}
      />

      <GuideCallout tone="lock">
        Screenshots are stored privately. A temporary signed link is
        generated only when the image is actually viewed — there&apos;s
        never a permanent public URL to your chart.
      </GuideCallout>

      <GuideCallout tone="tip">
        If you screenshot your own private trade detail (which can show
        dollar P&L) and attach it as a chart, that&apos;s your own choice
        about your own data — BigMarkt&apos;s public data feeds never expose
        raw dollar figures themselves.
      </GuideCallout>
    </article>
  );
}
