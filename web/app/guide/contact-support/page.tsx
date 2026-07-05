import type { Metadata } from "next";
import { GuideTitle, GuideLead } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Contact Support" };

export default function ContactSupportPage() {
  return (
    <article>
      <GuideTitle>Contact Support</GuideTitle>
      <GuideLead>
        Use the chat icon in the bottom corner of the app for direct
        support, or reach the team via Telegram.
      </GuideLead>
    </article>
  );
}
