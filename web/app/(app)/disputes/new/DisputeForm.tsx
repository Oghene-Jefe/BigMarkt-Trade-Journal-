"use client";

import { useState, useTransition } from "react";
import { raiseDisputeAction } from "@/lib/actions/disputes";
import type { DisputeReason } from "@/lib/types";

const REASONS: { value: DisputeReason; label: string }[] = [
  { value: "strategy_manipulation", label: "Strategy manipulation" },
  { value: "entry_price_falsification", label: "Entry price falsification" },
  { value: "intentional_follower_harm", label: "Intentional follower harm" },
  { value: "inactive_without_notice", label: "Inactive without notice" },
  { value: "other", label: "Other" },
];

export default function DisputeForm({ leaderId }: { leaderId: string }) {
  const [reason, setReason] = useState<DisputeReason>("strategy_manipulation");
  const [description, setDescription] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const descLen = description.length;
  const descValid = descLen >= 50 && descLen <= 1000;
  const canSubmit = !!leaderId && descValid && !pending;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await raiseDisputeAction(
        leaderId,
        reason,
        description,
        evidenceUrl.trim() || undefined
      );
      if ("error" in res && res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
      }
    });
  }

  if (!leaderId) {
    return (
      <p className="text-sm text-loss">
        Missing leader ID. Open this page from a subscription.
      </p>
    );
  }

  if (success) {
    return (
      <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-6">
        <p className="text-sm text-emerald-300">
          Dispute submitted. Our team will review within 48 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-white/10 bg-panel p-6">
      <div>
        <label className="mb-1 block text-xs text-muted">Reason</label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value as DisputeReason)}
          className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-base text-white"
        >
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          maxLength={1000}
          placeholder="Describe what happened in detail (minimum 50 characters)..."
          className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-base text-white"
        />
        <p className={`mt-1 text-xs ${descValid ? "text-muted" : "text-amber-300"}`}>
          {descLen}/1000 — minimum 50 characters
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs text-muted">Evidence link (optional)</label>
        <input
          type="url"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-base text-white"
        />
      </div>

      {error ? <p className="text-sm text-loss">{error}</p> : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-medium text-black disabled:opacity-40"
      >
        {pending ? "Submitting…" : "Submit dispute"}
      </button>
    </form>
  );
}
