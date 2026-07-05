import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Feed" };

export default function FeedPage() {
  return (
    <article>
      <GuideTitle>Feed</GuideTitle>
      <GuideLead>
        Feed shows live open positions and recent closed trades from people
        you follow — chart thumbnail and trade thesis included when the
        trader has shared them, dollar P&amp;L never shown.
      </GuideLead>

      <GuideNext href="/guide/reactions" label="Reactions" />
    </article>
  );
}
