"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { Search } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "@/components/FollowButton";
import { searchProfilesAction, type ProfileResult } from "@/lib/actions/search";

export default function DiscoverSearch({ currentUserId }: { currentUserId: string | null }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProfileResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [pending, startTransition] = useTransition();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onChange(value: string) {
    setQ(value);
    if (debounce.current) clearTimeout(debounce.current);
    const term = value.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        const rows = await searchProfilesAction(term);
        setResults(rows);
        setSearched(true);
      });
    }, 300);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <input
          type="text"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by name or @username…"
          className="w-full rounded-lg border border-white/10 bg-black/40 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-muted focus:border-gold/50 focus:outline-none"
          autoFocus
        />
      </div>

      {q.trim().length > 0 && q.trim().length < 2 ? (
        <p className="text-xs text-muted">Type at least 2 characters.</p>
      ) : null}

      {pending ? (
        <p className="text-sm text-muted">Searching…</p>
      ) : searched && results.length === 0 ? (
        <p className="text-sm text-muted">No traders found for "{q.trim()}".</p>
      ) : (
        <ul className="space-y-2">
          {results.map((r) => {
            const href = (r.username ? `/@${r.username}` : `/p/${r.user_id}`) as Route;
            return (
              <li
                key={r.user_id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-panel p-3"
              >
                <Link href={href} className="shrink-0">
                  <Avatar url={r.avatar_url} name={r.display_name} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={href}
                    className="block truncate text-sm font-semibold text-white hover:text-gold"
                  >
                    {r.display_name ?? (r.username ? `@${r.username}` : "Trader")}
                  </Link>
                  <div className="flex items-center gap-2">
                    {r.username ? (
                      <span className="truncate text-xs text-muted">@{r.username}</span>
                    ) : null}
                    {r.is_leader ? (
                      <span className="rounded border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                        Leader
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="shrink-0">
                  <FollowButton
                    leaderId={r.user_id}
                    leaderUsername={r.username}
                    currentUserId={currentUserId}
                    existingSubscription={null}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
