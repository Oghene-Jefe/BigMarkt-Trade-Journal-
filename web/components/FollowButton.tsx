"use client";

import { useTransition, useState, useEffect } from "react";
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

// Minimal local shape we can construct optimistically — enough for this
// component's own state machine (isActive / isPaused checks + unfollow id).
type LocalSub = { id: string; status: "active" | "paused" };

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

  // Local override — starts from the prop, but can move ahead of it after a
  // successful action, so surfaces that don't server-repaint (e.g. Discover's
  // client-side result list) still reflect the new state immediately.
  const [localSub, setLocalSub] = useState<LocalSub | null>(
    existingSubscription
      ? { id: existingSubscription.id, status: existingSubscription.status as "active" | "paused" }
      : null,
  );

  // If the parent re-renders with fresh server data (e.g. leaderboard after
  // router.refresh()), let it win — keeps this component correct on surfaces
  // that DO server-repaint, while still allowing local optimism where they don't.
  useEffect(() => {
    setLocalSub(
      existingSubscription
        ? { id: existingSubscription.id, status: existingSubscription.status as "active" | "paused" }
        : null,
    );
  }, [existingSubscription?.id, existingSubscription?.status]);

  if (!currentUserId) return null;
  if (currentUserId === leaderId) return null;

  const isActive = localSub?.status === "active";
  const isPaused = localSub?.status === "paused";

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
  if (isActive && localSub) {
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
                run(async () => {
                  const res = await updateSubscriptionAction(localSub.id, { status: "paused" });
                  if (!res || !("error" in res) || !res.error) {
                    setLocalSub({ id: localSub.id, status: "paused" });
                  }
                  return res;
                })
              }
            >
              Pause
            </MenuItem>
            <MenuItem
              tone="loss"
              onClick={() =>
                run(async () => {
                  const res = await unfollowLeaderAction(localSub.id);
                  if (!res || !("error" in res) || !res.error) {
                    setLocalSub(null);
                  }
                  return res;
                })
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
  if (isPaused && localSub) {
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
                run(async () => {
                  const res = await updateSubscriptionAction(localSub.id, { status: "active" });
                  if (!res || !("error" in res) || !res.error) {
                    setLocalSub({ id: localSub.id, status: "active" });
                  }
                  return res;
                })
              }
            >
              Resume
            </MenuItem>
            <MenuItem
              tone="loss"
              onClick={() =>
                run(async () => {
                  const res = await unfollowLeaderAction(localSub.id);
                  if (!res || !("error" in res) || !res.error) {
                    setLocalSub(null);
                  }
                  return res;
                })
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
      // Optimistically flip to Following immediately — critical for surfaces
      // like Discover where results are client state and router.refresh()
      // won't repaint them. Falls back to a placeholder id if the action
      // didn't return one; router.refresh() will still reconcile it on
      // server-rendered surfaces.
      if ("subscriptionId" in res && res.subscriptionId) {
        setLocalSub({ id: res.subscriptionId, status: "active" });
      } else {
        setLocalSub({ id: "pending", status: "active" });
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
