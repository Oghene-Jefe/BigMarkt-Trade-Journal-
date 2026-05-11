"use client";

import { useState, useTransition } from "react";
import {
  generateEaTokenAction,
  revokeEaTokenAction,
} from "@/lib/actions/ea-tokens";
import type { EaTokenRow } from "./page";

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

export default function EaTokenManager({ tokens }: { tokens: EaTokenRow[] }) {
  const [label, setLabel] = useState("");
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const atLimit = tokens.length >= MAX_TOKENS;

  function onGenerate() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await generateEaTokenAction(label || "My EA");
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setFreshToken(res.rawToken);
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

  async function onCopy() {
    if (!freshToken) return;
    try {
      await navigator.clipboard.writeText(freshToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select and copy manually.");
    }
  }

  return (
    <div className="space-y-4">
      {/* Freshly generated token — shown once */}
      {freshToken ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
            New token — copy it now
          </p>
          <p className="mt-1 text-[11px] text-emerald-200/80">
            This is the only time the raw token will be shown. If you lose it
            you'll have to generate a new one.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-black/50 px-3 py-2 text-xs font-mono text-emerald-200">
              {freshToken}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button
              type="button"
              onClick={() => setFreshToken(null)}
              className="rounded-md border border-white/20 px-3 py-2 text-xs text-muted hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      {/* Generate form */}
      {atLimit ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
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
            className="rounded-md bg-gold/90 px-4 py-2 text-sm font-medium text-black hover:bg-gold transition-colors disabled:opacity-50"
          >
            {pending ? "Generating…" : "Generate token"}
          </button>
        </div>
      )}

      {error ? (
        <p className="text-xs text-rose-300">{error}</p>
      ) : null}

      {/* Existing tokens */}
      {tokens.length === 0 ? (
        <p className="text-xs text-muted">No active tokens yet.</p>
      ) : (
        <ul className="space-y-2">
          {tokens.map((t) => (
            <li
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {t.label}
                </p>
                <p className="text-[11px] text-muted">
                  Created {formatDate(t.created_at)} · Last used{" "}
                  {formatDate(t.last_used_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(t.id)}
                disabled={pending}
                className="rounded-md border border-rose-500/40 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/10 transition-colors disabled:opacity-50"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
