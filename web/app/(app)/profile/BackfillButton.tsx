"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { backfillVerifiedVisibilityAction } from "./actions";

export default function BackfillButton({ count }: { count: number }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok?: string; error?: string } | null>(null);

  if (msg?.ok) {
    return <p className="text-sm text-win">{msg.ok}</p>;
  }

  function handleClick() {
    startTransition(async () => {
      const res = await backfillVerifiedVisibilityAction();
      setMsg(res);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gold/20 bg-gold/5 px-4 py-3">
      <p className="text-sm text-white">
        You have <strong>{count}</strong> verified trade{count !== 1 ? "s" : ""} that{" "}
        {count !== 1 ? "are" : "is"} still private.
      </p>
      <p className="text-xs text-muted">
        Share them with your followers in one click — existing trades won&apos;t be shared automatically until you do this.
      </p>
      {msg?.error ? <p className="text-xs text-loss">{msg.error}</p> : null}
      <div>
        <Button type="button" size="sm" disabled={pending} onClick={handleClick}>
          {pending ? "Sharing…" : "Share existing verified trades with followers"}
        </Button>
      </div>
    </div>
  );
}
