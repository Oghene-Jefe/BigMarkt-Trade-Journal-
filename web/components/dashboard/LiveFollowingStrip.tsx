"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  getFollowingOpenPositionsAction,
  type OpenPosition,
} from "@/lib/actions/feed";
import Avatar from "@/components/ui/Avatar";
import { fmtMoney } from "@/lib/format";

export default function LiveFollowingStrip({
  initial,
}: {
  initial: OpenPosition[];
}) {
  const [positions, setPositions] = useState(initial);

  useEffect(() => {
    const id = setInterval(async () => {
      const fresh = await getFollowingOpenPositionsAction();
      setPositions(fresh);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  if (positions.length === 0) return null;

  return (
    <div className="rounded-lg border border-white/10 bg-panel">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <span
          aria-hidden
          className="h-2 w-2 animate-pulse rounded-full bg-green-400"
        />
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Following · Live
        </span>
        <span className="ml-auto text-[10px] text-muted/60">
          {positions.length} open
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {positions.map((p) => {
          const href = (
            p.leader_username ? `/@${p.leader_username}` : `/p/${p.user_id}`
          ) as Route;
          const dirClass =
            p.direction === "BUY"
              ? "bg-win/20 text-win"
              : "bg-loss/20 text-loss";
          const pnlClass = (p.pnl ?? 0) >= 0 ? "text-win" : "text-loss";

          return (
            <Link
              key={p.trade_id}
              href={href}
              className="flex shrink-0 flex-col gap-1.5 rounded-md border border-white/10 bg-black/30 p-3 text-xs transition-colors hover:border-white/20"
            >
              <div className="flex items-center gap-1.5">
                <Avatar
                  url={p.leader_avatar_url}
                  name={p.leader_display_name}
                  size="sm"
                />
                <span className="max-w-[80px] truncate font-medium text-white">
                  {p.leader_display_name ?? p.leader_username ?? "Trader"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-white">{p.pair ?? "—"}</span>
                <span className={`rounded px-1 py-0.5 ${dirClass}`}>
                  {p.direction}
                </span>
              </div>
              <span className={`tabular-nums font-semibold ${pnlClass}`}>
                {fmtMoney(p.pnl)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
