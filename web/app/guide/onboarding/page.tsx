import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideH2,
  GuideCallout,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Onboarding" };

export default function OnboardingPage() {
  return (
    <article>
      <GuideTitle>Onboarding</GuideTitle>
      <GuideLead>
        The 3-step wizard that runs the first time you log in. All of it can
        be changed later in Profile.
      </GuideLead>

      <GuideH2>Step 1 — &quot;First, let&apos;s set up your identity.&quot;</GuideH2>
      <p className="text-sm text-white/80">
        Set your <strong>display name</strong> (how others see you) and your{" "}
        <strong>username</strong> — lowercase, numbers, and hyphens only,
        checked for availability as you type. This becomes your public URL:{" "}
        <code className="rounded bg-black/40 px-1 text-xs">
          bigmarkt.co/@yourname
        </code>
        . You can also click <strong>Skip</strong> and finish this later from
        Profile.
      </p>

      <GuideH2>Step 2 — &quot;How will you journal your trades?&quot;</GuideH2>
      <p className="text-sm text-white/80">
        <strong>Manual</strong> — &quot;I will log trades myself after each
        session.&quot; Next action: log your first trade.
        <br />
        <strong>Automated</strong> — &quot;I will connect my broker and
        capture trades automatically.&quot; Next action: connect your trading
        account.
      </p>

      <GuideH2>Step 3 — &quot;Prepare your public proof profile&quot;</GuideH2>
      <p className="text-sm text-white/80">
        Choose your starting visibility: <strong>Private</strong> (only you),{" "}
        <strong>Community</strong> (logged-in BigMarkt members), or{" "}
        <strong>Public</strong> (anyone with your profile link).
      </p>

      <GuideCallout tone="tip">
        Start Private and open up once your performance is ready to share —
        you can change this anytime.
      </GuideCallout>

      <GuideNext href="/guide/dashboard-tour" label="Dashboard Tour" />
    </article>
  );
}
