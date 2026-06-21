"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import {
  followLeaderAction,
  unfollowLeaderAction,
  updateSubscriptionAction,
  getMyBrokerAccountsAction,
} from "@/lib/actions/subscriptions";
import type { Subscription } from "@/lib/types";

// Follow is journal-only. Execution mode is disabled in the UI pre-authorisation.
// The broker account is still required by the DB schema so it is fetched silently
// when the user clicks Follow — they never see a picker.

type Props = {
  leaderId: string;
  leaderUsername: string | null;
  currentUserId: string | null;
  existingSubscription: Subscription | null;
};

export default function FollowButton({
  leaderId,
  leaderUsername,
  currentUserId,
  existingSubscription,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentUserId) return null;
  if (currentUserId === leaderId) return null;

  const isActive =
    existingSubscription && existingSubscription.status === "active";
  const isPaused =
    existingSubscription && existingSubscription.status === "paused";

  function run(fn: () => Promise<{ error?: string; success?: true } | void>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) {
        setError(res.error);
        return;
      }
      setMenuOpen(false);
      router.refresh();
    });
  }

  // ── Active following state ──────────────────────────────────────────────
  if (isActive && existingSubscription) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20 disabled:opacity-50"
        >
          {pending ? (
            "…"
          ) : (
            <>
              <span>Following</span>
              <ChevronDown size={14} aria-hidden />
            </>
          )}
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-white/10 bg-panel p-1 shadow-lg">
            <MenuItem
              onClick={() =>
                run(() =>
                  updateSubscriptionAction(existingSubscription.id, {
                    status: "paused",
                  })
                )
              }
            >
              Pause
            </MenuItem>
            <MenuItem
              tone="loss"
              onClick={() =>
                run(() => unfollowLeaderAction(existingSubscription.id))
              }
            >
              Unfollow
            </MenuItem>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-xs text-loss">{error}</p> : null}
      </div>
    );
  }

  // ── Paused state ───────────────────────────────────────────────────────
  if (isPaused && existingSubscription) {
    return (
      <div className="relative inline-block">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={pending}
          className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-muted hover:bg-white/10 disabled:opacity-50"
        >
          {pending ? (
            "…"
          ) : (
            <>
              <span>Paused</span>
              <ChevronDown size={14} aria-hidden />
            </>
          )}
        </button>
        {menuOpen ? (
          <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-white/10 bg-panel p-1 shadow-lg">
            <MenuItem
              onClick={() =>
                run(() =>
                  updateSubscriptionAction(existingSubscription.id, {
                    status: "active",
                  })
                )
              }
            >
              Resume
            </MenuItem>
            <MenuItem
              tone="loss"
              onClick={() =>
                run(() => unfollowLeaderAction(existingSubscription.id))
              }
            >
              Unfollow
            </MenuItem>
          </div>
        ) : null}
        {error ? <p className="mt-2 text-xs text-loss">{error}</p> : null}
      </div>
    );
  }

  // ── Not following — one-click Follow ──────────────────────────────────
  // Silently fetches the first available broker account (required by DB schema).
  // Journal-only mode only; no broker picker is shown to the user.
  function handleFollow() {
    setError(null);
    startTransition(async () => {
      const accountsRes = await getMyBrokerAccountsAction();
      if (!Array.isArray(accountsRes)) {
        setError(accountsRes.error);
        return;
      }
      if (accountsRes.length === 0) {
        setError("Connect a broker account first to follow traders.");
        return;
      }
      const res = await followLeaderAction(
        leaderId,
        accountsRes[0].id,
        "journal_only"
      );
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={handleFollow}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50"
      >
        {pending ? (
          "…"
        ) : (
          <>
            <Plus size={14} aria-hidden />
            <span>Follow</span>
          </>
        )}
      </button>
      {error ? <p className="mt-2 text-xs text-loss">{error}</p> : null}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "loss";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-white/5 ${
        tone === "loss" ? "text-loss" : "text-white"
      }`}
    >
      {children}
    </button>
  );
}
