import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideSteps,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Automated Mode & TOS" };

export default function AutomatedModeTosPage() {
  return (
    <article>
      <GuideTitle>Automated Mode & TOS</GuideTitle>
      <GuideLead>
        The one-time acknowledgment required before switching Journal Mode
        to Automated.
      </GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Profile</strong></>,
          <>Change <strong>Journal Mode</strong> to <strong>Automated</strong></>,
          <>A confirmation dialog explains what the EA does and doesn&apos;t do</>,
          <>Accept to proceed</>,
        ]}
      />

      <p className="mt-4 text-sm text-white/80">
        This is your confirmation that you understand the EA is read-only,
        and that you&apos;re responsible for checking your own broker&apos;s
        terms before connecting a live or funded account.
      </p>

      <GuideNext href="/guide/capture-troubleshooting" label="Troubleshooting Capture" />
    </article>
  );
}
