import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideH2,
  GuideCallout,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Edit or Delete a Trade" };

export default function EditOrDeleteTradePage() {
  return (
    <article>
      <GuideTitle>Edit or Delete a Trade</GuideTitle>
      <GuideLead>How editing and deleting rules differ by trade type.</GuideLead>

      <GuideH2>Editing</GuideH2>
      <p className="text-sm text-white/80">
        Open the trade from <strong>Journal</strong>, change a field, click{" "}
        <strong>Save</strong>.
      </p>

      <GuideCallout tone="warning">
        Auto-verified trades are different. Core fields (pair, direction,
        entry/exit, lot size, timestamps) lock once the EA captures them.
        You can still add Trade Thesis, notes, tags, and grade. Editing a
        locked field flags the trade <strong>Edited</strong> and reduces its
        leaderboard weight — this protects the integrity of verified data
        for everyone, including you.
      </GuideCallout>

      <GuideH2>Deleting</GuideH2>
      <p className="text-sm text-white/80">
        Open the trade &rarr; <strong>Delete</strong> &rarr; confirm. This
        can&apos;t be undone.
      </p>
    </article>
  );
}
