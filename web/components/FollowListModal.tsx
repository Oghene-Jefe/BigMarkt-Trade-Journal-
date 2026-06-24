"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { X } from "lucide-react";
import {
  getFollowListAction,
  type FollowListUser,
} from "@/lib/actions/follow-graph";
import Avatar from "@/components/ui/Avatar";

type Direction = "followers" | "following";

function profileHref(u: FollowListUser): Route {
  return (u.username ? `/@${u.username}` : `/p/${u.id}`) as Route;
}

export function FollowStats({
  profileId,
  followers,
  following,
}: {
  profileId: string;
  followers: number;
  following: number;
}) {
  const [open, setOpen] = useState<Direction | null>(null);

  return (
    <>
      <div className="flex items-center gap-5 text-sm">
        <button
          type="button"
          onClick={() => setOpen("followers")}
          className="rounded text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <b className="font-semibold text-white">{followers}</b> Followers
        </button>
        <button
          type="button"
          onClick={() => setOpen("following")}
          className="rounded text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <b className="font-semibold text-white">{following}</b> Following
        </button>
      </div>
      {open ? (
        <FollowListModal
          profileId={profileId}
          initial={open}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}

function FollowListModal({
  profileId,
  initial,
  onClose,
}: {
  profileId: string;
  initial: Direction;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Direction>(initial);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FollowListUser[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getFollowListAction(profileId, tab).then((data) => {
      if (!active) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [profileId, tab]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tab === "followers" ? "Followers" : "Following"}
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-white/10 bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-2">
          <div className="flex">
            {(["followers", "following"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setTab(d)}
                className={`rounded-t px-4 py-3 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  tab === d
                    ? "border-b-2 border-gold font-medium text-white"
                    : "text-muted hover:text-white"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mr-1 rounded p-1.5 text-muted transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="min-h-[8rem] flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {tab === "followers"
                ? "No followers yet"
                : "Not following anyone yet"}
            </p>
          ) : (
            <ul className="space-y-1">
              {rows.map((u) => (
                <li key={u.id}>
                  <Link
                    href={profileHref(u)}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                  >
                    <Avatar url={u.avatar_url} name={u.display_name ?? u.username} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-white">
                        {u.display_name || (u.username ? `@${u.username}` : "Trader")}
                      </span>
                      {u.username ? (
                        <span className="block truncate text-xs text-muted">
                          @{u.username}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
