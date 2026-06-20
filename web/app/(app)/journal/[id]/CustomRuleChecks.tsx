"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { setCustomRuleCheck } from "@/app/(app)/constitution/actions";

export type CustomRule = { id: string; text: string };
type Status = "followed" | "broke";

// Owner-only, optional self-attestation of CUSTOM rules on a single trade.
// Tapping the active choice again clears it. These never feed system adherence.
export default function CustomRuleChecks({
  tradeId,
  rules,
  initial,
}: {
  tradeId: string;
  rules: CustomRule[];
  initial: Record<string, Status>;
}) {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, Status | undefined>>(initial);
  const [pending, startTransition] = useTransition();

  function set(ruleId: string, choice: Status) {
    const current = statuses[ruleId];
    const next: Status | null = current === choice ? null : choice;
    // Optimistic update.
    setStatuses((s) => {
      const copy = { ...s };
      if (next === null) delete copy[ruleId];
      else copy[ruleId] = next;
      return copy;
    });
    startTransition(async () => {
      await setCustomRuleCheck(tradeId, ruleId, next);
      router.refresh();
    });
  }

  return (
    <section className="space-y-2">
      <h2 className="font-display text-sm uppercase tracking-widest text-muted">My Custom Rules</h2>
      <div className="rounded-xl border border-white/10 bg-panel p-4">
        <p className="text-xs text-muted">Self-check — optional. These are your own rules; we don&apos;t auto-check them.</p>
        <ul className="mt-3 space-y-3">
          {rules.map((r) => {
            const status = statuses[r.id];
            return (
              <li key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-white">{r.text}</span>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => set(r.id, "followed")}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                      status === "followed"
                        ? "border-win/50 bg-win/15 text-win"
                        : "border-white/15 text-muted hover:border-white/30"
                    }`}
                  >
                    <Check size={13} aria-hidden />
                    Followed
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => set(r.id, "broke")}
                    className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
                      status === "broke"
                        ? "border-loss/50 bg-loss/15 text-loss"
                        : "border-white/15 text-muted hover:border-white/30"
                    }`}
                  >
                    <X size={13} aria-hidden />
                    Broke
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
