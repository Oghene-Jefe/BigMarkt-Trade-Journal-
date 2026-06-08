"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState, useState } from "react";
import { signupAction, type ActionState } from "../actions";
import Logo from "@/components/ui/Logo";
import Turnstile from "@/components/Turnstile";

function SignupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signupAction, {});
  const searchParams = useSearchParams();
  const refFromUrl = searchParams.get("ref") ?? "";
  // Audit L-2: Turnstile token is captured via the Turnstile widget's
  // onToken callback and posted in the form via a hidden input.
  // verifyTurnstile() server-side fails open in dev (no secret), fails
  // closed in production — see web/lib/abuse.ts.
  const [turnstileToken, setTurnstileToken] = useState("");

  return (
    <form action={formAction} className="w-full max-w-sm space-y-4 rounded-lg bg-panel p-8">
      <div className="flex justify-center mb-6">
        <Link href="/" aria-label="Back to home">
          <Logo size="lg" />
        </Link>
      </div>
      <h1 className="text-center text-2xl font-semibold text-white">Create account</h1>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Name</span>
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={12}
          autoComplete="new-password"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">
          At least 12 characters.
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Referral code (optional)</span>
        <input
          name="referred_by"
          defaultValue={refFromUrl}
          maxLength={32}
          autoComplete="off"
          placeholder="Paste a friend's code"
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm"
        />
      </label>

      {/* Honeypot — must be empty. Hidden from real users. Kept as defense
          in depth alongside the new Turnstile check. */}
      <input
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      {/* Turnstile widget. Renders nothing in local dev (no site key).
          Captured token rides along in the hidden input below. */}
      <Turnstile onToken={setTurnstileToken} />
      <input type="hidden" name="turnstile_token" value={turnstileToken} />

      {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}

      <button
        disabled={pending}
        className="w-full rounded-md bg-gold py-3 text-sm font-medium text-black disabled:opacity-50"
      >
        {pending ? "Creating…" : "Sign up"}
      </button>

      <p className="text-center text-xs text-muted">
        By submitting, you agree to our{" "}
        <Link href="/privacy" className="text-white hover:underline">
          Privacy Policy
        </Link>
        .
      </p>

      <p className="text-center text-xs text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-white">
          Log in
        </Link>
      </p>

      <p className="text-center text-xs">
        <Link href="/" className="text-muted hover:text-white">
          ← Back to home
        </Link>
      </p>
    </form>
  );
}

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </main>
  );
}
