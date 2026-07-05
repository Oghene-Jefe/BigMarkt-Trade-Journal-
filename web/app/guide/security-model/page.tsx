import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Security Model" };

export default function SecurityModelPage() {
  return (
    <article>
      <GuideTitle>Security Model</GuideTitle>
      <GuideLead>How BigMarkt protects your data.</GuideLead>

      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
        <li>The EA is read-only — it has no code path to place, modify, or close a trade</li>
        <li>Your signing secret and connection credentials are encrypted, never stored or transmitted in plain text</li>
        <li>Chart screenshots and avatars are stored in private buckets — only short-lived signed links are generated, never a permanent public URL</li>
      </ul>

      <GuideNext href="/guide/public-vs-private" label="Public vs Private" />
    </article>
  );
}
