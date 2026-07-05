import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Following" };

export default function FollowingPage() {
  return (
    <article>
      <GuideTitle>Following</GuideTitle>
      <GuideLead>
        Following lists everyone you follow. From here you can pause a
        leader (their trades stop appearing in your feed until you resume),
        unfollow, or raise a dispute.
      </GuideLead>

      <GuideNext href="/guide/feed" label="Feed" />
    </article>
  );
}
