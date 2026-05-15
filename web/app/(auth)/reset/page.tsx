"use client";

import { useActionState } from "react";
import { requestResetAction, type ActionState } from "../actions";
import Logo from "@/components/ui/Logo";

export default function ResetPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(requestResetAction, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-panel p-8">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h1 className="font-display text-3xl tracking-widest text-gold">RESET PASSWORD</h1>
        <p className="text-sm text-muted">Enter your account email and we'll send a reset link.</p>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Email</span>
          <input name="email" type="email" required autoComplete="email"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
        {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}

        <button disabled={pending}
          className="w-full rounded-md bg-gold py-3 font-display tracking-widest text-black disabled:opacity-50">
          {pending ? "SENDING…" : "SEND LINK"}
        </button>
      </form>
    </main>
  );
}
