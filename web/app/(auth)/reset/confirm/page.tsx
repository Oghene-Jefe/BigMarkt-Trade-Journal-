"use client";

import { useActionState } from "react";
import { setNewPasswordAction, type ActionState } from "../../actions";
import Logo from "@/components/ui/Logo";

export default function ResetConfirmPage() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(setNewPasswordAction, {});

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={formAction} className="w-full max-w-sm space-y-4 rounded-2xl bg-panel p-8">
        <div className="flex justify-center mb-6">
          <Logo size="lg" />
        </div>
        <h1 className="font-display text-3xl tracking-widest text-gold">SET NEW PASSWORD</h1>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">New password</span>
          <input name="password" type="password" required minLength={6}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Confirm password</span>
          <input name="confirm" type="password" required minLength={6}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2" />
        </label>

        {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}

        <button disabled={pending}
          className="w-full rounded-md bg-gold py-3 font-display tracking-widest text-black disabled:opacity-50">
          {pending ? "SAVING…" : "SAVE PASSWORD"}
        </button>
      </form>
    </main>
  );
}
