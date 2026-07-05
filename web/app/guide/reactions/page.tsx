import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Reactions" };

export default function ReactionsPage() {
  return (
    <article>
      <GuideTitle>Reactions</GuideTitle>
      <GuideLead>
        React to any trade you can see with 🚀, 🎯, or 🔥 — one reaction
        per trade, tap again to remove it or pick a different one. Counts
        are shared across the feed, profile pages, and public share links.
      </GuideLead>

      <GuideNext href="/guide/leaderboard" label="Leaderboard" />
    </article>
  );
}
