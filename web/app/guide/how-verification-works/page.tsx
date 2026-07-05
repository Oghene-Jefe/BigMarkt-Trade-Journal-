import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideH2,
  GuideTable,
  GuideNext,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "How Verification Works" };

export default function HowVerificationWorksPage() {
  return (
    <article>
      <GuideTitle>How Verification Works</GuideTitle>
      <GuideLead>
        The concept behind BigMarkt&apos;s core differentiator: trades
        captured directly from your broker, not typed in by hand.
      </GuideLead>

      <p className="text-sm text-white/80">
        Anyone can screenshot a win. A verified record is what makes your
        performance trustworthy to yourself, and eventually to followers.
      </p>

      <GuideH2>The trust badge system</GuideH2>
      <p className="text-sm text-white/80">Every trade carries one of these:</p>

      <GuideTable
        headers={["Badge", "Meaning", "Editable?", "Counts toward leaderboard?"]}
        rows={[
          ["Auto-verified", "Captured directly by the EA on a live account", "Core fields locked", "Yes"],
          ["Manual", "You typed it in", "Fully editable", "No"],
          ["Prop firm", "Auto-captured from a prop firm account", "Core fields locked", "Separate prop-firm view only"],
          ["Demo", "Captured from a demo account", "Core fields locked", "Practice only"],
        ]}
      />

      <GuideH2>Read-only, by design</GuideH2>
      <p className="text-sm text-white/80">
        The EA never places, modifies, or closes a trade. It only watches
        your MT5 terminal and reports what already happened. There is no
        code path in the EA that can send an order.
      </p>

      <GuideNext href="/guide/install-the-ea" label="Install the EA" />
    </article>
  );
}
