import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Public vs Private" };

export default function PublicVsPrivatePage() {
  return (
    <article>
      <GuideTitle>Public vs Private</GuideTitle>
      <GuideLead>
        BigMarkt never exposes your raw dollar P&amp;L on any public
        surface — not your feed, not your profile, not the leaderboard.
        Public surfaces show return % first and RR ratio second. Lot size
        is shown (it&apos;s broker-relative and doesn&apos;t reveal your
        account size) alongside entry/exit and your chart, if you&apos;ve
        made the trade public. Your own private Dashboard and Journal
        always show real dollar figures — only you see those.
      </GuideLead>

      <GuideNext href="/guide/data-rights" label="Your Data Rights" />
    </article>
  );
}
