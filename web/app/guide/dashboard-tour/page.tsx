import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideTable,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Dashboard Tour" };

export default function DashboardTourPage() {
  return (
    <article>
      <GuideTitle>Dashboard Tour</GuideTitle>
      <GuideLead>A 60-second orientation to your Dashboard.</GuideLead>

      <GuideTable
        headers={["Area", "What it shows"]}
        rows={[
          ["Activation panel", "Prompts to finish setup (connect EA, log first trade) if you haven't yet"],
          ["Stats row", "Win rate, total P&L, best pair, average RR"],
          ["Account switcher", "Switch between connected broker accounts, if you have more than one"],
          ["Open positions", "Live open trades on your connected account(s)"],
          ["Recent trades", "Your latest logged trades"],
          ["Following strip", "Recent activity from traders you follow"],
        ]}
      />

      <GuideRelated
        links={[
          { href: "/guide/multi-account-management", label: "Multi-Account Management" },
        ]}
      />
    </article>
  );
}
