"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const REACTIONS = [
  { key: "rocket", emoji: "🚀" },
  { key: "target", emoji: "🎯" },
  { key: "fire", emoji: "🔥" },
] as const;

const EMOJI: Record<string, string> = { rocket: "🚀", target: "🎯", fire: "🔥" };

type Row = { reaction: string; cnt: number; reacted: boolean };

export default function ReactionPicker({ tradeId }: { tradeId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    await sb.auth.getSession();
    const { data } = await sb.rpc("get_trade_reactions", { p_trade_id: tradeId });
    if (data) setRows(data as Row[]);
  }, [tradeId]);

  useEffect(() => {
    load();
  }, [load]);

  // Close the picker when clicking outside it.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const react = useCallback(
    async (reaction: string) => {
      if (busy) return;
      setBusy(true);
      const sb = supabaseBrowser();
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
      setBusy(false);
      setOpen(false);
    },
    [tradeId, busy]
  );

  const myReaction = rows.find((r) => r.reacted)?.reaction ?? null;
  const existing = rows.filter((r) => r.cnt > 0);

  return (
    <div ref={wrapRef} className="relative flex items-center gap-2">
      {existing.map((r) => {
        const mine = r.reaction === myReaction;
        return (
          <button
            key={r.reaction}
            type="button"
            onClick={() => react(r.reaction)}
            disabled={busy}
            className={`group flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs transition disabled:opacity-40 ${
              mine ? "text-gold" : "text-muted hover:text-white"
            }`}
          >
            <span className="text-base leading-none transition-transform duration-150 group-hover:scale-125 group-active:scale-90">
              {EMOJI[r.reaction]}
            </span>
            <span className="tabular-nums">{r.cnt}</span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-7 w-7 items-center justify-center rounded-full text-muted transition-all duration-200 hover:bg-white/5 hover:text-white ${
          open ? "rotate-45 bg-white/10 text-white" : ""
        }`}
        aria-label="Add reaction"
      >
        <span className="text-base leading-none">＋</span>
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 z-10 mb-2 flex animate-[pop_160ms_ease-out] items-center gap-1.5 rounded-full border border-white/10 bg-panel px-2 py-1.5 shadow-xl">
          {REACTIONS.map(({ key, emoji }, i) => (
            <button
              key={key}
              type="button"
              onClick={() => react(key)}
              disabled={busy}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`flex h-9 w-9 animate-[rise_220ms_ease-out_both] items-center justify-center rounded-full text-xl transition-transform duration-150 hover:-translate-y-1 hover:scale-125 active:scale-95 disabled:opacity-40 ${
                key === myReaction ? "bg-gold/15" : "hover:bg-white/10"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
