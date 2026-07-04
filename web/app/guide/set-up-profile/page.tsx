import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideSteps,
  GuideCallout,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Set Up Your Profile" };

export default function SetUpProfilePage() {
  return (
    <article>
      <GuideTitle>Set Up Your Profile</GuideTitle>
      <GuideLead>
        Your starting balance drives every growth-% calculation across your
        Dashboard, Analytics, and public profile.
      </GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Profile</strong></>,
          <>Set your <strong>display name</strong> and <strong>username</strong></>,
          <>Upload an <strong>avatar</strong> (optional — compressed automatically)</>,
          <>Enter your <strong>starting balance</strong></>,
          <>Set your <strong>timezone</strong></>,
          <>Click <strong>Save</strong></>,
        ]}
      />

      <GuideCallout tone="warning">
        Balance changed since you started? Use <strong>Balance Reset</strong>{" "}
        below the main form instead of editing the number directly — it keeps
        a dated history so your growth % stays accurate instead of being
        retroactively distorted.
      </GuideCallout>

      <GuideRelated
        links={[{ href: "/guide/referrals", label: "Referral Program" }]}
      />
    </article>
  );
}
