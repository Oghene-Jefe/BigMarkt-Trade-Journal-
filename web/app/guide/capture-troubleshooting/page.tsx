import type { Metadata } from "next";
import {
  GuideTitle,
  GuideLead,
  GuideH2,
  GuideRelated,
} from "@/components/guide/GuideBlocks";

export const metadata: Metadata = { title: "Troubleshooting Capture" };

export default function CaptureTroubleshootingPage() {
  return (
    <article>
      <GuideTitle>Troubleshooting Capture</GuideTitle>
      <GuideLead>Common issues with automated trade capture.</GuideLead>

      <GuideH2>&quot;EA installed but no trades appearing&quot;</GuideH2>
      <p className="text-sm text-white/80">
        Confirm AutoTrading is enabled in MT5 (toolbar button must be
        green). Check EA Setup — is it still showing &quot;Waiting for
        first trade&quot;? That&apos;s normal until your next trade. The EA
        only captures while MT5 is open and connected — if your terminal
        was closed when a trade opened or closed, that event is missed.
      </p>

      <GuideH2>&quot;A trade shows a blank result or incomplete exit data&quot;</GuideH2>
      <p className="text-sm text-white/80">
        This can happen if MT5 was closed at the moment a position actually
        closed — BigMarkt can only infer it closed, not recover the real
        exit price. When this happens, the trade is automatically kept
        private rather than shown incomplete on your public profile or the
        leaderboard. Your private journal still has an honest record of it.
      </p>

      <GuideH2>&quot;My trade fields are locked and I can&apos;t fix a mistake&quot;</GuideH2>
      <p className="text-sm text-white/80">
        That&apos;s expected for auto-verified trades. You can still add
        thesis, notes, tags, and grade.
      </p>

      <GuideRelated
        links={[
          { href: "/guide/edit-or-delete-a-trade", label: "Edit or Delete a Trade" },
          { href: "/guide/contact-support", label: "Contact Support" },
        ]}
      />
    </article>
  );
}
