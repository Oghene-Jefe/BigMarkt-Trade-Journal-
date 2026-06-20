"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Check, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { setActiveAccountAction } from "@/app/(app)/accounts/actions";
import type { ActiveAccountOption } from "@/lib/accounts";

const TYPE_LABEL: Record<string, string> = {
  live: "Live",
  demo: "Demo",
  prop_firm: "Prop",
};

function typeLabel(t: string): string {
  return TYPE_LABEL[t] ?? t;
}

// Global account switcher in the app shell. The active account is the single
// source of truth that scopes the dashboard + journal. Selecting an account
// persists it via setActiveAccountAction, then refreshes so server components
// re-read the new active id.
export default function AccountSwitcher({
  activeId,
  accounts,
}: {
  activeId: string;
  accounts: ActiveAccountOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside + Escape close the dropdown.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (accounts.length === 0) return null;

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0];

  function select(id: string) {
    setOpen(false);
    if (id === activeId) return;
    startTransition(async () => {
      await setActiveAccountAction(id);
      router.refresh();
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex max-w-[200px] items-center gap-1.5 rounded-md border border-white/10 bg-panel/60 px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:border-white/20 disabled:opacity-60"
      >
        <Wallet size={13} aria-hidden className="shrink-0 text-gold" />
        <span className="truncate">{active?.label}</span>
        <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
          {typeLabel(active?.account_type ?? "")}
        </span>
        <ChevronDown size={13} aria-hidden className="shrink-0 text-muted" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-60 overflow-hidden rounded-md border border-white/10 bg-panel shadow-lg"
        >
          <ul className="max-h-80 overflow-y-auto py-1">
            {accounts.map((a) => {
              const isActive = a.id === activeId;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    onClick={() => select(a.id)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
                      isActive
                        ? "bg-gold/10 text-gold"
                        : "text-muted hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="flex-1 truncate font-medium">{a.label}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide opacity-70">
                      {typeLabel(a.account_type)}
                    </span>
                    {isActive ? (
                      <Check size={14} aria-hidden className="shrink-0" />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
