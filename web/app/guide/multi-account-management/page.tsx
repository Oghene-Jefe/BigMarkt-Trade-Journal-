import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideSteps,
  GuideCallout,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Multi-Account Management" };

export default function MultiAccountManagementPage() {
  return (
    <article>
      <GuideTitle>Multi-Account Management</GuideTitle>
      <GuideLead>
        Connecting and managing more than one broker account — personal,
        demo, or prop firm.
      </GuideLead>

      <GuideSteps
        items={[
          <>Go to <strong>Accounts</strong></>,
          <>Click <strong>Add Account</strong></>,
          <>Give it a label, choose account type: <strong>Live</strong>, <strong>Demo</strong>, or <strong>Prop Firm</strong></>,
          <>Save — switch between accounts from the account switcher on your Dashboard</>,
        ]}
      />

      <GuideCallout tone="warning">
        Prop firm accounts are automatically locked to Manual (Journal Only)
        mode. The EA only reads and logs your trades — it never places,
        modifies, or closes trades, and copy/signal features (not yet
        built) will never be enabled on a prop firm account. This protects
        you from breaching your prop firm&apos;s terms.
      </GuideCallout>

      <GuideRelated
        links={[
          { href: "/guide/broker-compatibility", label: "Broker Compatibility" },
        ]}
      />
    </article>
  );
}
