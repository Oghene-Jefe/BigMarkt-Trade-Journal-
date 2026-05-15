"use client";

import { useState, useMemo, useTransition } from "react";
import { X, Plus } from "lucide-react";
import { BROKERS } from "@/lib/brokers";
import { createBrokerAccountAction } from "./actions";

type AccountType = "live" | "demo" | "prop_firm";
type JournalMode = "manual" | "automated";

export default function AddAccountModal() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [brokerSlug, setBrokerSlug] = useState("");
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("live");
  const [journalMode, setJournalMode] = useState<JournalMode>("manual");
  const [accountNumber, setAccountNumber] = useState("");
  const [readonlyPassword, setReadonlyPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const eligible = useMemo(
    () => BROKERS.filter((b) => b.status === "supported" || b.status === "partial"),
    []
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((b) => b.name.toLowerCase().includes(q));
  }, [eligible, search]);

  const selectedBroker = useMemo(
    () => eligible.find((b) => b.id === brokerSlug) ?? null,
    [eligible, brokerSlug]
  );

  const propFirmLocked = accountType === "prop_firm";
  const demoLocked = accountType === "demo";
  const modeLocked = propFirmLocked || demoLocked;
  const effectiveMode: JournalMode = modeLocked ? "manual" : journalMode;

  function reset() {
    setSearch("");
    setBrokerSlug("");
    setBrokerError(null);
    setLabel("");
    setAccountType("live");
    setJournalMode("manual");
    setAccountNumber("");
    setReadonlyPassword("");
    setError(null);
  }

  function pickBroker(id: string, name: string) {
    setBrokerSlug(id);
    setSearch(name);
    setBrokerError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!brokerSlug) {
      setBrokerError("Please pick a broker from the list.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    fd.set("broker_slug", brokerSlug);
    fd.set("journal_mode", effectiveMode);

    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.log("createBrokerAccount submit:", Object.fromEntries(fd.entries()));
    }

    startTransition(async () => {
      const res = await createBrokerAccountAction(fd);
      if (res && "error" in res) {
        setError(res.error);
        return;
      }
      reset();
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90"
      >
        <Plus size={14} aria-hidden />
        <span>Add account</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/10 bg-gray-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add broker account</h2>
              <button
                onClick={() => { reset(); setOpen(false); }}
                aria-label="Close"
                className="text-white/60 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-white/80">Label</label>
                <input
                  name="label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                  maxLength={50}
                  placeholder="e.g. IC Markets Live"
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Broker</label>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    // typing invalidates the previous pick unless it matches
                    if (selectedBroker && e.target.value !== selectedBroker.name) {
                      setBrokerSlug("");
                    }
                  }}
                  placeholder="Search brokers…"
                  className="mb-2 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
                <input type="hidden" name="broker_slug" value={brokerSlug} />
                <div className="max-h-44 overflow-y-auto rounded-md border border-white/10 bg-black/40">
                  {filtered.length === 0 ? (
                    <p className="p-3 text-xs text-white/40">No brokers match.</p>
                  ) : (
                    <ul>
                      {filtered.map((b) => {
                        const active = b.id === brokerSlug;
                        return (
                          <li key={b.id}>
                            <button
                              type="button"
                              onClick={() => pickBroker(b.id, b.name)}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/10 ${
                                active ? "bg-white/10 text-white" : "text-white/80"
                              }`}
                            >
                              <span>{b.name}</span>
                              {b.prop_firm && (
                                <span className="text-[10px] text-amber-300">Prop Firm</span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {selectedBroker && (
                  <p className="mt-1 text-[11px] text-emerald-300">
                    Selected: {selectedBroker.name}
                  </p>
                )}
                {brokerError && (
                  <p className="mt-1 text-xs text-rose-400">{brokerError}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Account Type</label>
                <select
                  name="account_type"
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value as AccountType)}
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                >
                  <option value="live">Live</option>
                  <option value="demo">Demo</option>
                  <option value="prop_firm">Prop firm</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Journal Mode</label>
                {demoLocked ? (
                  <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70">
                    Manual only — demo accounts cannot run automated mode.
                  </div>
                ) : propFirmLocked ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    Manual only — prop firm accounts cannot run automated mode. Copy execution is disabled.
                  </div>
                ) : (
                  <select
                    value={journalMode}
                    onChange={(e) => setJournalMode(e.target.value as JournalMode)}
                    className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="manual">Manual</option>
                    <option value="automated">Automated</option>
                  </select>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Account Number (optional)</label>
                <input
                  name="account_number"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. 12345678"
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-white/80">Read-Only Password (optional)</label>
                <input
                  name="readonly_password"
                  type="text"
                  value={readonlyPassword}
                  onChange={(e) => setReadonlyPassword(e.target.value)}
                  maxLength={200}
                  placeholder="Investor/read-only password only — never your master password"
                  className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
                />
                <p className="mt-1 text-[11px] text-amber-400">
                  Never enter your master trading password. Read-only password only.
                </p>
              </div>

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { reset(); setOpen(false); }}
                  className="rounded-md border border-white/20 px-4 py-2 text-sm text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
