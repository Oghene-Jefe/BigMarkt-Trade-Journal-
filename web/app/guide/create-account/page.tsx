import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideCallout,
  GuideSteps,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Create Your Account" };

export default function CreateAccountPage() {
  return (
    <article>
      <GuideTitle>Create Your Account</GuideTitle>
      <GuideLead>
        This is a read-only journaling platform tied to your identity as a
        trader — getting your account right from day one keeps your verified
        record clean.
      </GuideLead>

      <GuideSteps
        items={[
          <>Go to journal.bigmarkt.co</>,
          <>Click <strong>Sign Up</strong></>,
          <>Enter your email and password</>,
          <>Complete the human-verification check</>,
          <>Click <strong>Create Account</strong></>,
          <>Check your inbox and click the verification link — you&apos;ll land back in the app, logged in</>,
        ]}
      />

      <GuideCallout tone="tip">
        Have a referral code? If someone shared their link with you, sign up
        through that link so they get credit.
      </GuideCallout>

      <GuideNext href="/guide/onboarding" label="Complete Onboarding" />
    </article>
  );
}
