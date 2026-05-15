"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus } from "lucide-react";
import {
  followLeaderAction,
  unfollowLeaderAction,
  updateSubscriptionAction,
  getMyBrokerAccountsAction,
  type MyBrokerAccountOption,
} from "@/lib/actions/subscriptions";
import type { Subscription, SubscriptionMode } from "@/lib/types";

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
  const [modalOpen, setModalOpen] = useState(false);
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
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-white/10 bg-panel p-1 shadow-lg">
            {existingSubscription.mode !== "journal_only" ? (
              <MenuItem
                onClick={() =>
                  run(() =>
                    updateSubscriptionAction(existingSubscription.id, {
                      mode: "journal_only",
                    })
                  )
                }
              >
                Change to Journal Only
              </MenuItem>
            ) : null}
            {existingSubscription.mode !== "execution" ? (
              <MenuItem
                onClick={() =>
                  run(() =>
                    updateSubscriptionAction(existingSubscription.id, {
                      mode: "execution",
                    })
                  )
                }
              >
                Change to Execution
              </MenuItem>
            ) : null}
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
        {error ? (
          <p className="mt-2 text-xs text-loss">{error}</p>
        ) : null}
      </div>
    );
  }

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
        {error ? (
          <p className="mt-2 text-xs text-loss">{error}</p>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50"
      >
        <Plus size={14} aria-hidden />
        <span>Follow</span>
      </button>
      {modalOpen ? (
        <FollowModal
          leaderId={leaderId}
          leaderUsername={leaderUsername}
          onClose={() => setModalOpen(false)}
          onDone={() => {
            setModalOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
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

function FollowModal({
  leaderId,
  leaderUsername,
  onClose,
  onDone,
}: {
  leaderId: string;
  leaderUsername: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<SubscriptionMode>("journal_only");
  const [accounts, setAccounts] = useState<MyBrokerAccountOption[] | null>(null);
  const [accountsErr, setAccountsErr] = useState<string | null>(null);
  const [brokerAccountId, setBrokerAccountId] = useState<string>("");
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "execution" || accounts !== null) return;
    (async () => {
      const res = await getMyBrokerAccountsAction();
      if (Array.isArray(res)) {
        setAccounts(res);
        if (res.length > 0) setBrokerAccountId(res[0].id);
      } else {
        setAccountsErr(res.error);
      }
    })();
  }, [mode, accounts]);

  function submit() {
    setError(null);
    if (mode === "execution" && !brokerAccountId) {
      setError("Select a broker account");
      return;
    }
    if (mode === "journal_only" && !brokerAccountId && accounts === null) {
      // For journal_only we still need *a* broker account id (schema requires it).
      // Lazy-load accounts now.
      (async () => {
        const res = await getMyBrokerAccountsAction();
        if (Array.isArray(res)) {
          setAccounts(res);
          if (res.length > 0) {
            setBrokerAccountId(res[0].id);
            doSubmit(res[0].id);
          } else {
            setError("You need a follower broker account first");
          }
        } else {
          setError(res.error);
        }
      })();
      return;
    }
    doSubmit(brokerAccountId);
  }

  function doSubmit(accId: string) {
    if (!accId) {
      setError("Select a broker account");
      return;
    }
    startSubmit(async () => {
      const res = await followLeaderAction(leaderId, accId, mode);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-white/10 bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-white">
          Follow {leaderUsername ? `@${leaderUsername}` : "this trader"}
        </h3>
        <p className="mt-1 text-xs text-muted">Choose how you want to follow.</p>

        <div className="mt-5 space-y-2">
          <ModeOption
            selected={mode === "journal_only"}
            onClick={() => setMode("journal_only")}
            title="Journal Only"
            desc="See signals in my feed"
          />
          <ModeOption
            selected={mode === "execution"}
            onClick={() => setMode("execution")}
            title="Execution"
            desc="Auto-execute on my broker account"
          />
        </div>

        {mode === "execution" ? (
          <div className="mt-5">
            <label className="text-xs uppercase tracking-wider text-muted">
              Broker Account
            </label>
            {accountsErr ? (
              <p className="mt-2 text-xs text-loss">{accountsErr}</p>
            ) : accounts === null ? (
              <p className="mt-2 text-xs text-muted">Loading…</p>
            ) : accounts.length === 0 ? (
              <p className="mt-2 text-xs text-loss">
                No follower broker accounts. Add one in Settings first.
              </p>
            ) : (
              <select
                value={brokerAccountId}
                onChange={(e) => setBrokerAccountId(e.target.value)}
                className="mt-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.display_name} ({a.broker_name})
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : null}

        {error ? <p className="mt-4 text-xs text-loss">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-white/10 px-4 py-2 text-sm text-muted hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50"
          >
            {submitting ? "…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeOption({
  selected,
  onClick,
  title,
  desc,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`block w-full rounded-md border p-3 text-left transition ${
        selected
          ? "border-gold bg-gold/10"
          : "border-white/10 bg-black/30 hover:border-white/20"
      }`}
    >
      <p
        className={`text-sm font-medium ${
          selected ? "text-gold" : "text-white"
        }`}
      >
        {title}
      </p>
      <p className="mt-1 text-xs text-muted">{desc}</p>
    </button>
  );
}
