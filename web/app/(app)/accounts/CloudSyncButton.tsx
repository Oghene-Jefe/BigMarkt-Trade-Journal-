"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { cloudSyncStep } from "./metaapi-actions";

const MAX_POLLS = 60; // ~5 min at 5s intervals
const POLL_MS = 5000;

export default function CloudSyncButton({ connectionId }: { connectionId: string }) {
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const cancelled = useRef(false);
  useEffect(() => () => { cancelled.current = true; }, []);

  async function run() {
    if (busy) return;
    setBusy(true);
    setIsError(false);
    setLabel("Starting…");
    for (let i = 0; i < MAX_POLLS; i++) {
      let res;
      try {
        res = await cloudSyncStep(connectionId);
      } catch {
        if (!cancelled.current) { setIsError(true); setLabel("Something went wrong. Try again."); }
        setBusy(false);
        return;
      }
      if (cancelled.current) return;
      if (!res.ok) { setIsError(true); setLabel(res.error); setBusy(false); return; }
      if (res.done) {
        setIsError(false);
        setLabel(`Synced — ${res.imported} imported${res.skipped ? `, ${res.skipped} skipped` : ""}.`);
        setBusy(false);
        return;
      }
      setLabel(
        res.phase === "provisioning" ? "Setting up…"
        : res.phase === "connecting" ? "Connecting…"
        : "Deploying…",
      );
      await new Promise((r) => setTimeout(r, POLL_MS));
      if (cancelled.current) return;
    }
    setIsError(true);
    setLabel("Timed out — try again shortly.");
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-2">
      {label && <span className={`text-xs ${isError ? "text-loss" : "text-muted"}`}>{label}</span>}
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10 disabled:opacity-50"
      >
        <RefreshCw size={12} className={busy ? "animate-spin" : ""} aria-hidden />
        {busy ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
