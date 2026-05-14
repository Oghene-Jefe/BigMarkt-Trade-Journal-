"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { connectBybitAction, type ConnectActionState } from "./actions";

// Client component for the Bybit connect form.
//
// Two non-obvious things about this form:
//
// 1. NO TYPE="PASSWORD" ANYWHERE. Browsers (and 1Password / LastPass /
//    Chrome's built-in manager) detect a credential-login form by the
//    presence of <input type="password"> next to a username-shaped field.
//    Using type="text" with CSS-based masking sidesteps that heuristic
//    entirely so the save-passwords-prompt and autofill suggestions never
//    appear. Field names are also renamed away from "apiKey"/"apiSecret"
//    (which Chrome heuristics also flag) to non-credential-shaped slugs.
//
// 2. CONTROLLED INPUTS. React 19's Server Action progressive enhancement
//    resets uncontrolled forms after submission completion, even when the
//    action returns an error state. To preserve the user's input across
//    a Bybit rejection (so they don't have to re-paste the secret), every
//    field is controlled by useState.

export default function ConnectForm() {
  const [state, formAction, pending] = useActionState<ConnectActionState, FormData>(
    connectBybitAction,
    {},
  );

  // Controlled values — survive across action submissions.
  const [label, setLabel] = useState("");
  const [environment, setEnvironment] = useState<"mainnet" | "testnet">("mainnet");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  // Common attributes that signal "this is NOT a login form" to password
  // managers. Browsers respect different subsets of these; piling them
  // on is the only reliable suppression.
  const noAutofill = {
    autoComplete: "off",
    spellCheck: false,
    "data-1p-ignore": "true",        // 1Password
    "data-lpignore": "true",         // LastPass
    "data-form-type": "other",       // Bitwarden + generic
    "data-bwignore": "true",         // Bitwarden alt
  } as const;

  // CSS-based password masking. `-webkit-text-security: disc` masks chars
  // in WebKit/Blink (Chrome/Safari/Edge/Brave). Firefox doesn't support it
  // — for FF users the secret stays readable, which is fine for an opt-in
  // field they're pasting from somewhere else anyway.
  const maskedInput = !showSecret
    ? { style: { WebkitTextSecurity: "disc" } as React.CSSProperties }
    : {};

  return (
    <form action={formAction} className="space-y-5 rounded-2xl bg-panel p-6" autoComplete="off">
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
          value={label}
          onChange={(e) => setLabel(e.target.value)}
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
          value={environment}
          onChange={(e) => setEnvironment(e.target.value as "mainnet" | "testnet")}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        >
          <option value="mainnet">Mainnet (api.bybit.com)</option>
          <option value="testnet">Testnet (api-testnet.bybit.com)</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">API Key</span>
        <input
          // Hidden name="apiKey" matches the server action; visible name on
          // the input is a non-credential-shaped slug so Chrome heuristics
          // don't flag the field.
          name="apiKey"
          id="bm_external_id"
          required
          minLength={8}
          maxLength={128}
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          {...noAutofill}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">API Secret</span>
        <div className="relative">
          <input
            name="apiSecret"
            id="bm_external_token"
            required
            minLength={8}
            maxLength={128}
            // Always type="text" — masking is CSS-based via WebkitTextSecurity.
            // No type="password" anywhere on this form means password managers
            // see no login pattern and stay quiet.
            type="text"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            {...noAutofill}
            {...maskedInput}
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
