"use client";

import { useState, useEffect, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const REACTIONS = [
  { key: "rocket", emoji: "🚀" },
  { key: "target", emoji: "🎯" },
  { key: "fire", emoji: "🔥" },
] as const;

type Row = { reaction: string; cnt: number; reacted: boolean };

export default function ReactionBar({ tradeId }: { tradeId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    await sb.auth.getSession();
    const { data } = await sb.rpc("get_trade_reactions", { p_trade_id: tradeId });
    if (data) setRows(data as Row[]);
  }, [tradeId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (reaction: string) => {
      if (busy) return;
      setBusy(reaction);
      const sb = supabaseBrowser();
      // Force session hydration so the RPC carries the user's JWT (not anon).
      await sb.auth.getSession();
      const { data, error } = await sb.rpc("toggle_trade_reaction", {
        p_trade_id: tradeId,
        p_reaction: reaction,
      });
      if (!error && data) {
        const normalized = (data as { out_reaction: string; out_cnt: number; out_reacted: boolean }[]).map(
          (d) => ({ reaction: d.out_reaction, cnt: d.out_cnt, reacted: d.out_reacted })
        );
        setRows(normalized);
      }
      setBusy(null);
    },
    [tradeId, busy]
  );

  const countFor = (key: string) => rows.find((r) => r.reaction === key)?.cnt ?? 0;
  const reactedFor = (key: string) => rows.find((r) => r.reaction === key)?.reacted ?? false;

  return (
    <div className="mt-2 flex items-center gap-1.5">
      {REACTIONS.map(({ key, emoji }) => {
        const count = countFor(key);
        const reacted = reactedFor(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            disabled={busy === key}
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition disabled:opacity-50 ${
              reacted
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-white/10 text-muted hover:border-white/30 hover:text-white"
            }`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {count > 0 ? <span className="tabular-nums">{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
