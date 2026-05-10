"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { connectBybitAction, type ConnectActionState } from "./actions";

// Client component so we can useActionState for inline error display.
// Form values stay client-side until submit; on submit the server action
// receives FormData and decides everything (Bybit probe, validate, encrypt).
export default function ConnectForm() {
  const [state, formAction, pending] = useActionState<ConnectActionState, FormData>(
    connectBybitAction,
    {},
  );
  const [showSecret, setShowSecret] = useState(false);

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-panel p-6">
      <div>
        <h2 className="font-display text-xl tracking-widest text-gold">CONNECT BYBIT</h2>
        <p className="mt-1 text-xs text-muted">
          Read-only API key only. BigMarkt rejects keys with withdraw, transfer, or trading scope.
        </p>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Label</span>
        <input
          name="label"
          required
          maxLength={80}
          placeholder="My main account"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">
          Anything that helps you identify this connection later.
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Environment</span>
        <select
          name="environment"
          defaultValue="mainnet"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        >
          <option value="mainnet">Mainnet (api.bybit.com)</option>
          <option value="testnet">Testnet (api-testnet.bybit.com)</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">API Key</span>
        <input
          name="apiKey"
          required
          minLength={8}
          maxLength={128}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">API Secret</span>
        <div className="relative">
          <input
            name="apiSecret"
            required
            minLength={8}
            maxLength={128}
            type={showSecret ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 pr-16 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShowSecret((v) => !v)}
            className="absolute right-1 top-1 rounded px-2 py-1 text-xs text-muted hover:bg-white/5"
            tabIndex={-1}
          >
            {showSecret ? "hide" : "show"}
          </button>
        </div>
        <span className="mt-1 block text-xs text-muted">
          Never logged or stored in plaintext. Encrypted at rest with AES-256-GCM under a
          per-connection HKDF-derived key.
        </span>
      </label>

      <div className="rounded-md border border-gold/20 bg-gold/5 p-3 text-xs text-muted">
        <p className="font-medium text-gold">Before you connect</p>
        <ul className="mt-2 list-inside list-disc space-y-0.5">
          <li>Use a <strong className="text-white">read-only</strong> API key only.</li>
          <li>Never enable <strong className="text-white">withdrawals</strong> or transfers.</li>
          <li>Never enable trading / order placement.</li>
          <li>For best security, IP-restrict the key once BigMarkt has a stable sync IP.</li>
        </ul>
      </div>

      {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}

      <div className="flex items-center justify-end gap-2">
        <Link href="/exchanges" className="rounded-md border border-white/20 px-4 py-2 text-sm">
          Cancel
        </Link>
        <button
          disabled={pending}
          className="rounded-md bg-gold px-6 py-2 font-display tracking-widest text-black disabled:opacity-50"
        >
          {pending ? "VERIFYING…" : "CONNECT"}
        </button>
      </div>
    </form>
  );
}
