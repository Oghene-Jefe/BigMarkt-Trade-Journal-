"use client";

import { useState, useTransition } from "react";
import { setEaTradesVisibility } from "@/lib/actions/ea-visibility";

export default function EaVisibilityToggle({
  userId,
  initialValue,
}: {
  userId: string;
  initialValue: boolean;
}) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setEaTradesVisibility(
        userId,
        next ? "community" : "private",
      );
      if (!result.success) {
        setEnabled(!next); // revert
        setError(result.error ?? "Failed to update. Please try again.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-white">
            Show EA trades on public profile
          </p>
          <p className="text-xs text-muted">
            When enabled, your EA-verified trades will be visible on your public
            profile
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={isPending}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
            enabled ? "bg-gold" : "bg-white/20"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {error ? (
        <p className="text-xs text-loss">{error}</p>
      ) : null}
    </div>
  );
}
