import type { Metadata } from "next";
import { GuideTitle, GuideLead, GuideNext } from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <article>
      <GuideTitle>Notifications</GuideTitle>
      <GuideLead>
        The bell icon shows unread alerts: new followers, score updates,
        and status changes (under review, suspended, reinstated, or
        inactive) for leaders you follow. Mark individually or all as read.
      </GuideLead>

      <GuideNext href="/guide/free-vs-pro" label="Free vs Pro" />
    </article>
  );
}
