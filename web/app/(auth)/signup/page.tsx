"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type ActionState } from "../actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(signupAction, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-panel p-8">
        <h1 className="font-display text-3xl tracking-widest text-gold">CREATE ACCOUNT</h1>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Name</span>
          <input name="name" required maxLength={80} autoComplete="name"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email</span>
          <input name="email" type="email" required autoComplete="email"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Password</span>
          <input name="password" type="password" required minLength={6} autoComplete="new-password"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        {/* Honeypot — must be empty. Hidden from real users. */}
        <input name="website" type="text" tabIndex={-1} autoComplete="off"
          className="hidden" aria-hidden="true" />

        {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}

        <button disabled={pending}
          className="w-full rounded-md bg-gold py-3 font-display tracking-widest text-black disabled:opacity-50">
          {pending ? "CREATING…" : "SIGN UP"}
        </button>

        <p className="text-center text-xs text-muted">
          Already have an account? <Link href="/login" className="text-white">Log in</Link>
        </p>
      </form>
    </main>
  );
}
