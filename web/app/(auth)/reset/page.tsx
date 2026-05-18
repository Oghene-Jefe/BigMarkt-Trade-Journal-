"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { requestResetAction, type ActionState } from "../actions";
import Logo from "@/components/ui/Logo";
import Turnstile from "@/components/Turnstile";

export default function ResetPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(requestResetAction, {});
  // Audit N-H7: Turnstile token rides along in a hidden input so the
  // server action can call verifyTurnstile() before queueing a reset
  // email. Same pattern as the signup form (L-2). Fails closed in
  // production if NEXT_PUBLIC_TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY
  // aren't set in Vercel — broker submissions already use the same gate.
  const [turnstileToken, setTurnstileToken] = useState("");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-panel p-8">
        <div className="flex justify-center mb-6">
          <Link href="/" aria-label="Back to home">
            <Logo size="lg" />
          </Link>
        </div>
        <h1 className="text-center text-2xl font-semibold text-white">Reset password</h1>
        <p className="text-sm text-muted">Enter your account email and we'll send a reset link.</p>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email</span>
          <input name="email" type="email" required autoComplete="email"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        {/* Turnstile widget. Renders nothing in local dev (no site key);
            captured token rides along in the hidden input below. */}
        <Turnstile onToken={setTurnstileToken} />
        <input type="hidden" name="turnstile_token" value={turnstileToken} />

        {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}

        <button disabled={pending}
          className="w-full rounded-md bg-gold py-3 text-sm font-medium text-black disabled:opacity-50">
          {pending ? "Sending…" : "Send link"}
        </button>

        <p className="text-center text-xs">
          <Link href="/" className="text-muted hover:text-white">
            ← Back to home
          </Link>
        </p>
      </form>
    </main>
  );
}
