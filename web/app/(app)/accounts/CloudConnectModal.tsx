"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Cloud } from "lucide-react";
import { BROKERS } from "@/lib/brokers";
import { provisionConnectionAction, type ProvisionResult } from "./metaapi-actions";

type AccountType = "live" | "demo" | "prop_firm";

// Admin-gated "Connect via cloud" flow (MetaApi auto-provisioning). Calls
// provisionConnectionAction, which validates the server, provisions the cloud
// account with the INVESTOR (read-only) password, and records a
// metaapi_connections row as 'provisioning'. The metaapi-sync cron advances it
// to 'active'. The password is sent once to the server action and never stored.
export default function CloudConnectModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [brokerSlug, setBrokerSlug] = useState("");
  const [brokerError, setBrokerError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("live");
  const [server, setServer] = useState("");
  const [login, setLogin] = useState("");
  const [investorPassword, setInvestorPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  // When equal to the current server on submit, bypass the known-server check.
  const [confirmServer, setConfirmServer] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const eligible = useMemo(
    () => BROKERS.filter((b) => b.status === "supported" || b.status === "partial"),
    [],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((b) => b.name.toLowerCase().includes(q));
  }, [eligible, search]);
  const selectedBroker = useMemo(
    () => eligible.find((b) => b.id === brokerSlug) ?? null,
    [eligible, brokerSlug],
  );

  function reset() {
    setSearch(""); setBrokerSlug(""); setBrokerError(null);
    setLabel(""); setAccountType("live"); setServer(""); setLogin(""); setInvestorPassword("");
    setError(null); setSuggestions(null); setConfirmServer(null); setDone(false);
  }
  function close() { reset(); setOpen(false); }

  function pickBroker(id: string, name: string) {
    setBrokerSlug(id); setSearch(name); setBrokerError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setBrokerError(null);
    if (!brokerSlug) { setBrokerError("Please pick a broker from the list."); return; }

    const confirmUnknown = confirmServer !== null && confirmServer === server.trim();

    const fd = new FormData();
    fd.set("label", label);
    fd.set("broker_slug", brokerSlug);
    fd.set("account_type", accountType);
    fd.set("server", server);
    fd.set("login", login);
    fd.set("investor_password", investorPassword);
    if (confirmUnknown) fd.set("confirm_unknown_server", "true");

    startTransition(async () => {
      const res: ProvisionResult = await provisionConnectionAction(fd);
      if (res.ok) {
        setDone(true);
        router.refresh();
        return;
      }
      setError(res.error);
      setSuggestions(res.serverSuggestions ?? null);
      setConfirmServer(res.serverSuggestions ? server.trim() : null);
    });
  }

  const inputCls =
    "w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-gold/40 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/10"
      >
        <Cloud size={14} aria-hidden />
        <span>Connect via cloud</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-white/10 bg-gray-900 p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Connect via cloud</h2>
              <button onClick={close} aria-label="Close" className="text-white/60 hover:text-white">
                <X size={18} aria-hidden />
              </button>
            </div>

            {done ? (
              <div className="space-y-4">
                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                  Cloud connection started. We're provisioning your account with the broker — this
                  can take a few minutes. It appears in your accounts list right away as
                  "Provisioning" and switches on automatically once it's live.
                </div>
                <div className="flex justify-end">
                  <button onClick={close} className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90">
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <p className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
                  Cloud connect is limited to admins during the preview. Enter your MT5 details and
                  your INVESTOR (read-only) password — never your master password.
                </p>

                <div>
                  <label className="mb-1 block text-sm text-white/80">Label</label>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} required maxLength={50}
                    placeholder="e.g. IC Markets Live" className={inputCls} />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-white/80">Broker</label>
                  <input type="text" value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      if (selectedBroker && e.target.value !== selectedBroker.name) setBrokerSlug("");
                    }}
                    placeholder="Search brokers…" className={`mb-2 ${inputCls}`} />
                  <div className="max-h-44 overflow-y-auto rounded-md border border-white/10 bg-black/40">
                    {filtered.length === 0 ? (
                      <p className="p-3 text-xs text-white/40">No brokers match.</p>
                    ) : (
                      <ul>
                        {filtered.map((b) => {
                          const active = b.id === brokerSlug;
                          return (
                            <li key={b.id}>
                              <button type="button" onClick={() => pickBroker(b.id, b.name)}
                                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/10 ${active ? "bg-white/10 text-white" : "text-white/80"}`}>
                                <span>{b.name}</span>
                                {b.prop_firm && <span className="text-[10px] text-amber-300">Prop Firm</span>}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {selectedBroker && <p className="mt-1 text-[11px] text-emerald-300">Selected: {selectedBroker.name}</p>}
                  {brokerError && <p className="mt-1 text-xs text-rose-400">{brokerError}</p>}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-white/80">Account Type</label>
                  <select value={accountType} onChange={(e) => setAccountType(e.target.value as AccountType)} className={inputCls}>
                    <option value="live">Live</option>
                    <option value="demo">Demo</option>
                    <option value="prop_firm">Prop firm</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-white/80">MT5 Server</label>
                  <input value={server} onChange={(e) => setServer(e.target.value)} required maxLength={120}
                    placeholder="e.g. ICMarketsSC-MT5" className={inputCls} />
                  {suggestions && suggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="mb-1 text-[11px] text-white/50">Did you mean:</p>
                      <div className="flex flex-wrap gap-1">
                        {suggestions.map((s) => (
                          <button key={s} type="button"
                            onClick={() => { setServer(s); setConfirmServer(null); setSuggestions(null); setError(null); }}
                            className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-white/80 hover:bg-white/10">
                            {s}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1 text-[11px] text-white/40">…or submit again to use "{server}" exactly as typed.</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm text-white/80">Login (account number)</label>
                  <input value={login} onChange={(e) => setLogin(e.target.value)} required maxLength={32}
                    inputMode="numeric" placeholder="e.g. 12345678" className={inputCls} />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-white/80">Investor (read-only) Password</label>
                  <input type="password" value={investorPassword} onChange={(e) => setInvestorPassword(e.target.value)}
                    required maxLength={200} placeholder="Investor password only" className={inputCls}
                    autoComplete="off" />
                  <p className="mt-1 text-[11px] text-amber-400">
                    Never enter your master trading password. It's used once to connect and is never stored.
                  </p>
                </div>

                {error && <p className="text-sm text-rose-400">{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={close} className="rounded-md border border-white/20 px-4 py-2 text-sm text-white">
                    Cancel
                  </button>
                  <button type="submit" disabled={pending}
                    className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50">
                    {pending ? "Connecting…" : "Connect account"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
