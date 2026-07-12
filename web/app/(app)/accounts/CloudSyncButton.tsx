"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { syncNowAction } from "./metaapi-actions";

export default function CloudSyncButton({ connectionId }: { connectionId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await syncNowAction(connectionId);
      if (res.ok) {
        setMsg(res.message);
        setIsError(false);
      } else {
        setMsg(res.error);
        setIsError(true);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {msg && <span className={`text-xs ${isError ? "text-loss" : "text-muted"}`}>{msg}</span>}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10 disabled:opacity-50"
      >
        <RefreshCw size={12} className={pending ? "animate-spin" : ""} aria-hidden />
        {pending ? "Syncing…" : "Sync now"}
      </button>
    </div>
  );
}
