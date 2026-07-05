import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Discover" };

export default function DiscoverPage() {
  return (
    <article>
      <GuideTitle>Discover</GuideTitle>
      <GuideLead>
        Go to Discover, search by name or username, follow anyone with a
        Community or Public profile. Private profiles never appear in
        search.
      </GuideLead>

      <GuideNext href="/guide/following" label="Following" />
    </article>
  );
}
