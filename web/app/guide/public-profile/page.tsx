import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Public Profile" };

export default function PublicProfilePage() {
  return (
    <article>
      <GuideTitle>Public Profile</GuideTitle>
      <GuideLead>
        Your profile lives at bigmarkt.co/@yourusername once you&apos;re
        Community visibility or above. It shows your trust-badged trades,
        stats, and a share button for posting your record elsewhere.
      </GuideLead>

      <GuideNext href="/guide/notifications" label="Notifications" />
    </article>
  );
}
