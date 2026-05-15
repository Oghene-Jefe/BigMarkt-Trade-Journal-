"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { connectBybitAction, type ConnectActionState } from "./actions";

// Client component for the Bybit connect form.
//
// Defeating password-manager autofill turned out to need four layered
// defences because each manager respects different signals:
//
//   1. NO TYPE="PASSWORD" ANYWHERE.
//      Chrome / 1Password / LastPass / Bitwarden classify a form as a
//      "login" by the presence of <input type="password"> next to a
//      text input. Removing type="password" entirely makes the
//      heuristic miss. Secret is masked via CSS (`-webkit-text-security`)
//      instead.
//
//   2. NON-CREDENTIAL `name` ATTRIBUTES.
//      "apiKey", "username", "email", "password" trigger name-based
//      heuristics in Chrome and Safari. The visible `name=` is
//      `x_external_id` / `x_external_token` — neutral, opaque. The
//      server action accepts both old + new keys for backward compat.
//
//   3. autoComplete="one-time-code".
//      Apple Keychain in particular ignores `autoComplete="off"` and
//      every `data-*-ignore` attribute. It DOES respect "one-time-code"
//      (designed for SMS verification codes) as a strong signal that
//      this field is not a credential. Most reliable Safari fix.
//
//   4. readOnly + onFocus removal.
//      Belt-and-braces for Safari: any input that starts `readonly`
//      doesn't trigger autofill because Safari's check fires on focus
//      of an editable input. Removing the attribute on first focus
//      means the field becomes editable AFTER Safari has already
//      decided not to offer autofill. JS-only, costs nothing.
//
// Plus controlled inputs (useState) so React 19's Server Action form-
// reset behaviour doesn't wipe the API key + secret when the Bybit
// probe returns an error.

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

  // readOnly state per real field. React's controlled-input re-renders
  // would otherwise restore readOnly on every keystroke (because the JSX
  // says readOnly is true). State-tracking it means the attribute is
  // removed permanently after the first focus, so subsequent typing works
  // but Safari's autofill decision at initial focus saw a readonly field
  // and didn't offer anything.
  const [keyReadOnly, setKeyReadOnly] = useState(true);
  const [secretReadOnly, setSecretReadOnly] = useState(true);

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

  // Visual masking for the secret. We deliberately avoid
  // `-webkit-text-security: disc` — Safari's autofill heuristic checks
  // that CSS property as a credential-field signal and pops the
  // Keychain UI even without type="password". `filter: blur(6px)`
  // achieves the same visual effect (you can't read the secret over a
  // shoulder) without tripping any password-manager detector.
  const maskedInput = !showSecret
    ? { style: { filter: "blur(6px)" } as React.CSSProperties }
    : {};

  return (
    <form action={formAction} className="space-y-5 rounded-lg bg-panel p-6" autoComplete="off">
      {/*
        Honeypot autofill absorbers. Browsers (especially Safari/iCloud
        Keychain) will autofill the *first* username+password pair they
        find on the page; these hidden decoys catch the autofill before
        it reaches the real fields below. Server action ignores the
        username/password keys entirely.

        display:none specifically — `aria-hidden` + `tabIndex=-1` keeps
        screen readers + keyboard navigation out, and the empty values
        are never submitted to the server because the action's Zod
        schema doesn't read them. Position absolute / off-screen alone
        is not enough — modern Safari requires display:none to skip
        screen-reader announcement of the decoy.
      */}
      <div aria-hidden="true" style={{ display: "none" }}>
        <input type="text" name="username" autoComplete="username" tabIndex={-1} defaultValue="" />
        <input type="password" name="password" autoComplete="current-password" tabIndex={-1} defaultValue="" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-white">Connect Bybit</h2>
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
          name="x_external_id"
          id="x_external_id"
          required
          minLength={8}
          maxLength={128}
          type="text"
          aria-autocomplete="none"
          readOnly={keyReadOnly}
          onFocus={() => setKeyReadOnly(false)}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          {...noAutofill}
          // After the spread so it wins over noAutofill's autoComplete="off".
          // "one-time-code" is Apple Keychain's documented "not a login" hint.
          autoComplete="one-time-code"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">API Secret</span>
        <div className="relative">
          <input
            name="x_external_token"
            id="x_external_token"
            required
            minLength={8}
            maxLength={128}
            // Always type="text" — masking is CSS-based via WebkitTextSecurity.
            // No type="password" anywhere on this form means password managers
            // see no login pattern and stay quiet.
            type="text"
            aria-autocomplete="none"
            readOnly={secretReadOnly}
            onFocus={() => setSecretReadOnly(false)}
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            {...noAutofill}
            {...maskedInput}
            // After the spread so it wins over noAutofill's autoComplete="off".
            autoComplete="one-time-code"
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
        <Link
          href="/exchanges"
          className="inline-flex h-10 items-center rounded-md border border-white/15 px-4 text-sm hover:bg-white/5"
        >
          Cancel
        </Link>
        <button
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-gold px-5 text-sm font-medium text-black disabled:opacity-50"
        >
          {pending ? "Verifying…" : "Connect"}
        </button>
      </div>
    </form>
  );
}
