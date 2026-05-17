"use client";

import { useState, useTransition } from "react";
import { Check, AlertTriangle, Plug, PlugZap } from "lucide-react";
import {
  generateEaTokenAction,
  revokeEaTokenAction,
  linkEaTokenToAccountAction,
  type EaConnectionLogEntry,
} from "@/lib/actions/ea-tokens";
import { StatusPill } from "@/components/ui";
import type { EaTokenRow, WsStatus, BrokerAccountOption } from "./page";

const MAX_TOKENS = 5;

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function WsStatusCard({ status }: { status: WsStatus | null }) {
  let tone: "ok" | "warn" | "error" = "error";
  let title = "WebSocket server — offline";
  let body = "Start the WebSocket server locally with npm run dev.";

  if (status) {
    if (status.connected_clients === 0) {
      tone = "warn";
      title = "WebSocket server — online, no EA connected";
      body = "Server is running. Connect your MT4/MT5 EA to begin receiving trades.";
    } else {
      tone = "ok";
      title = `WebSocket server — online · ${status.connected_clients} EA connected`;
      body = "Receiving trade events in real time.";
    }
  }

  const borderByTone = {
    ok: "border-emerald-500/40 bg-emerald-500/10",
    warn: "border-amber-500/40 bg-amber-500/10",
    error: "border-rose-500/40 bg-rose-500/10",
  } as const;

  return (
    <div className={`rounded-md border p-4 ${borderByTone[tone]}`}>
      <div className="flex items-center gap-2">
        <StatusPill tone={tone}>{title}</StatusPill>
      </div>
      <p className="mt-2 text-xs text-white/70">{body}</p>
      {status && status.connected_clients > 0 ? (
        <ul className="mt-3 space-y-1">
          {status.connections.map((c) => {
            const secs = Math.round(c.last_ping_ms_ago / 1000);
            return (
              <li key={c.token_id} className="flex items-center gap-2 text-xs">
                {c.stale ? (
                  <>
                    <AlertTriangle size={12} aria-hidden className="text-amber-300" />
                    <span className="text-amber-300">
                      EA connected but not responding — last seen {secs}s ago
                    </span>
                  </>
                ) : (
                  <>
                    <PlugZap size={12} aria-hidden className="text-emerald-300" />
                    <span className="text-emerald-300">
                      EA active — last ping {secs}s ago
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
      {status ? (
        <p className="mt-2 text-[11px] text-muted">
          Uptime: {formatUptime(status.server_uptime_seconds)}
        </p>
      ) : null}
    </div>
  );
}

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? "" : "s"} ago`;
}

function ConnectionHistory({ log }: { log: EaConnectionLogEntry[] }) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel p-5">
      <header>
        <h3 className="text-sm font-medium text-white">Connection history</h3>
        <p className="mt-1 text-xs text-muted">
          Last 20 EA connect / disconnect events.
        </p>
      </header>
      {log.length === 0 ? (
        <p className="mt-3 text-xs text-muted">No connections recorded yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-white/5 rounded-md border border-white/10 bg-black/30">
          {log.slice(0, 20).map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs"
            >
              <span className="min-w-[140px]">
                {row.event === "connected" ? (
                  <StatusPill tone="ok" icon={<PlugZap size={12} aria-hidden />}>
                    Connected
                  </StatusPill>
                ) : (
                  <StatusPill tone="error" icon={<Plug size={12} aria-hidden />}>
                    Disconnected
                  </StatusPill>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-white">{row.label}</span>
              <span className="font-mono text-muted">{row.ip ?? "unknown"}</span>
              <span className="text-muted">{formatRelative(row.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function EaTokenManager({
  tokens,
  wsStatus = null,
  connectionLog = [],
  brokerAccounts = [],
}: {
  tokens: EaTokenRow[];
  wsStatus?: WsStatus | null;
  connectionLog?: EaConnectionLogEntry[];
  brokerAccounts?: BrokerAccountOption[];
}) {
  const [label, setLabel] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [freshSigningSecret, setFreshSigningSecret] = useState<string | null>(null);
  const [freshTokenId, setFreshTokenId] = useState<string | null>(null);
  const [copied, setCopied] = useState<"token" | "secret" | "id" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const atLimit = tokens.length >= MAX_TOKENS;

  function onGenerate() {
    setError(null);
    setCopied(null);
    startTransition(async () => {
      const res = await generateEaTokenAction(label || "My EA");
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setFreshToken(res.rawToken);
      setFreshSigningSecret(res.signingSecret);
      setFreshTokenId(res.id);
      setLabel("");
    });
  }

  function onRevoke(id: string) {
    if (!confirm("Revoke this token? Any EA using it will stop sending trades.")) return;
    setError(null);
    startTransition(async () => {
      const res = await revokeEaTokenAction(id);
      if ("error" in res) setError(res.error);
    });
  }

  async function onCopy(which: "token" | "secret" | "id") {
    const text =
      which === "token" ? freshToken : which === "secret" ? freshSigningSecret : freshTokenId;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("Could not copy — select and copy manually.");
    }
  }

  return (
    <div className="space-y-4">
      <WsStatusCard status={wsStatus} />

      {freshToken ? (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold text-emerald-300">
            New token — copy ALL THREE values now
          </p>
          <p className="mt-1 text-[11px] text-emerald-200/80">
            This is the only time these values will be shown. The MT5 EA needs
            all three: the token UUID is bound into every signed payload, the
            bearer token authenticates the request, and the signing secret
            signs each trade payload (v2 replay protection). If you lose any
            of them, you'll have to generate a new token.
          </p>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/80">
              Token UUID
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-black/50 px-3 py-2 text-xs font-mono text-emerald-200">
                {freshTokenId}
              </code>
              <button
                type="button"
                onClick={() => onCopy("id")}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied === "id" ? (
                  <>
                    <Check size={12} aria-hidden />
                    <span>Copied</span>
                  </>
                ) : (
                  "Copy"
                )}
              </button>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/80">
              Bearer token
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-black/50 px-3 py-2 text-xs font-mono text-emerald-200">
                {freshToken}
              </code>
              <button
                type="button"
                onClick={() => onCopy("token")}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied === "token" ? (
                  <>
                    <Check size={12} aria-hidden />
                    <span>Copied</span>
                  </>
                ) : (
                  "Copy"
                )}
              </button>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200/80">
              Signing secret
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 break-all rounded bg-black/50 px-3 py-2 text-xs font-mono text-emerald-200">
                {freshSigningSecret}
              </code>
              <button
                type="button"
                onClick={() => onCopy("secret")}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied === "secret" ? (
                  <>
                    <Check size={12} aria-hidden />
                    <span>Copied</span>
                  </>
                ) : (
                  "Copy"
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setFreshToken(null);
                setFreshSigningSecret(null);
                setFreshTokenId(null);
              }}
              className="rounded-md border border-white/15 px-3 py-2 text-xs text-muted hover:text-white"
            >
              I've saved all three — dismiss
            </button>
          </div>
        </div>
      ) : null}

      {atLimit ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          You've hit the {MAX_TOKENS}-token limit. Revoke one below before
          generating another.
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[200px] text-xs text-muted">
            Label
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. ICMarkets MT5"
              maxLength={60}
              className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
          </label>
          <button
            type="button"
            onClick={onGenerate}
            disabled={pending}
            className="inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-medium text-black hover:bg-gold/90 disabled:opacity-50"
          >
            {pending ? "Generating…" : "Generate token"}
          </button>
        </div>
      )}

      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {tokens.length === 0 ? (
        <p className="text-xs text-muted">No active tokens yet.</p>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => {
            const linkedLabel =
              brokerAccounts.find((a) => a.id === t.broker_account_id)?.label ?? null;
            return (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 bg-black/30 p-3"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-white">
                    <span className="truncate">{t.label}</span>
                    {t.is_legacy ? (
                      <StatusPill
                        tone="warn"
                        icon={<AlertTriangle size={10} aria-hidden />}
                      >
                        Legacy — regenerate for v2 replay protection
                      </StatusPill>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-muted">
                    Created {formatDate(t.created_at)} · Last used{" "}
                    {formatDate(t.last_used_at)}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[10px] text-muted">
                    ID: {t.id}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {linkedLabel ? (
                      <span className="text-white/80">Linked: {linkedLabel}</span>
                    ) : (
                      <span>No account linked</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <form action={linkEaTokenToAccountAction as unknown as (fd: FormData) => void}>
                    <input type="hidden" name="token_id" value={t.id} />
                    <select
                      name="broker_account_id"
                      defaultValue={t.broker_account_id ?? ""}
                      onChange={(e) => e.currentTarget.form?.requestSubmit()}
                      className="rounded-md border border-white/10 bg-black/40 px-2 py-1 text-sm text-white"
                    >
                      <option value="">— No account —</option>
                      {brokerAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </form>
                  <button
                    type="button"
                    onClick={() => onRevoke(t.id)}
                    disabled={pending}
                    className="rounded-md border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConnectionHistory log={connectionLog} />
    </div>
  );
}
