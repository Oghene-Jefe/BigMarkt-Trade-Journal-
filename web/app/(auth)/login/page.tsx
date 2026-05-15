"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type ActionState } from "../actions";
import Logo from "@/components/ui/Logo";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(loginAction, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-panel p-8">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h1 className="font-display text-3xl tracking-widest text-gold">ENTER THE MARKET</h1>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email</span>
          <input name="email" type="email" required autoComplete="email"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Password</span>
          <input name="password" type="password" required minLength={6} autoComplete="current-password"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}

        <button disabled={pending}
          className="w-full rounded-md bg-gold py-3 font-display tracking-widest text-black disabled:opacity-50">
          {pending ? "SIGNING IN…" : "LOG IN"}
        </button>

        <div className="flex items-center justify-between text-xs text-muted">
          <Link href="/signup" className="hover:text-white">Create account</Link>
          <Link href="/reset" className="hover:text-white">Forgot password?</Link>
        </div>
      </form>
    </main>
  );
}
