import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideSteps, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Challenges" };

export default function ChallengesPage() {
  return (
    <article>
      <GuideTitle>Challenges</GuideTitle>
      <GuideLead>
        Self-set trading goals with a start/end date and a target.
      </GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Challenges</strong></>,
          <>Click <strong>New Challenge</strong>, set a goal type, target, and date range</>,
          <>Track progress from the Challenges page — active challenges show current streak; finished ones show pass/fail</>,
        ]}
      />

      <GuideNext href="/guide/dashboard-analytics" label="Dashboard Analytics" />
    </article>
  );
}
