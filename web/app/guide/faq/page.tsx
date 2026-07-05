import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  GuideTitle,
  GuideLead,
  GuideH2,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "FAQ" };

function QA({ q, a }: { q: string; a: ReactNode }) {
  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-white">{q}</p>
      <p className="mt-1 text-sm text-white/70">{a}</p>
    </div>
  );
}

export default function FaqPage() {
  return (
    <article>
      <GuideTitle>FAQ</GuideTitle>
      <GuideLead>Common questions, grouped by topic.</GuideLead>

      <GuideH2>Account & Setup</GuideH2>
      <QA q="I skipped part of onboarding — where do I finish it?" a="Everything from the wizard (display name, username, journal mode, visibility) lives in Profile. Nothing is lost by skipping." />
      <QA q="Can I change my username later?" a="Yes, from Profile — as long as the new one is available. Note this changes your public profile URL." />
      <QA q="Can I use BigMarkt without connecting a broker?" a="Yes — Manual journal mode requires no broker connection at all. You can switch to Automated anytime." />

      <GuideH2>Verified Auto-Capture</GuideH2>
      <QA q="I installed the EA but no trades are showing up. What's wrong?" a="Check that AutoTrading is enabled in MT5 and that MT5 is actually open and connected to your broker. The EA only captures while the terminal is running." />
      <QA q="Why can't I edit the entry price on an auto-verified trade?" a="Core fields lock once the EA captures them — that's what makes a trade verified rather than self-reported. You can still add Trade Thesis, notes, tags, and grade." />
      <QA q="A trade shows up with no exit price / blank result. Why?" a="This happens when MT5 was closed at the exact moment a position closed. These trades are automatically kept private so they never show incomplete publicly." />
      <QA q="Can I connect a prop firm account?" a="Yes, but it's automatically locked to journal-only mode — nothing about copy or signal features will ever activate on it." />

      <GuideH2>Privacy & Data</GuideH2>
      <QA q="Can other people see my exact dollar profit or loss?" a="No. Public surfaces show return % and RR ratio. Only you see real dollars, on your own private Dashboard and Journal." />
      <QA q="Is my lot size public?" a="Yes, if the trade itself is public — lot size doesn't reveal your account balance, so it's kept visible by design." />
      <QA q="How do I delete my account and data?" a="Contact support to start a full account and data purge." />

      <GuideH2>Leaderboard & Community</GuideH2>
      <QA q="Why isn't my trading showing up on the leaderboard?" a="Leaderboard eligibility requires at least 30 auto-verified trades on a live account, spanning at least 30 days, with positive expectancy. Manual, demo, and prop-firm trades never count." />
      <QA q="What happens when I pause a leader I follow?" a="Their trades stop appearing in your Feed until you resume — it doesn't unfollow them." />
      <QA q="What's the difference between Following and Discover?" a="Discover is for finding new traders by name/username. Following is the list of people you've already chosen to follow." />

      <GuideH2>Plans & Referrals</GuideH2>
      <QA q="How do I get BigMarkt Pro?" a="Pro is coming soon — not billable yet. Join the waitlist from Upgrade. Founding leaders may already have it comped." />
      <QA q="What do I get for referring someone?" a="Right now, tracking only — your referral count shows on Profile. Reward mechanics haven't shipped yet." />

      <GuideRelated
        links={[{ href: "/guide/contact-support", label: "Contact Support" }]}
      />
    </article>
  );
}
