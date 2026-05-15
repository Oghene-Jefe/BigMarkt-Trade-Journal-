"use client";

import { useActionState } from "react";
import { createBalanceResetAction, type BalanceActionState } from "../balance/actions";

export default function BalanceResetForm({ currentBalance }: { currentBalance: number | null }) {
  const [state, formAction, pending] = useActionState<BalanceActionState, FormData>(
    createBalanceResetAction,
    {},
  );

  return (
    <form action={formAction} className="rounded-lg border border-white/10 bg-panel p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Current</span>
          <input
            disabled
            value={currentBalance != null ? `$${currentBalance.toLocaleString()}` : "not set"}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-muted"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">New balance</span>
          <input
            name="new_balance"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="10000"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Reason (optional)</span>
          <input
            name="reason"
            maxLength={200}
            placeholder="Funded · Withdrawal · Top-up"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
        </label>
      </div>
      {state.error ? <p className="mt-2 text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-win">{state.ok}</p> : null}
      <div className="mt-3 flex justify-end">
        <button
          disabled={pending}
          className="inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-medium text-black disabled:opacity-50"
        >
          {pending ? "Saving…" : "Reset balance"}
        </button>
      </div>
    </form>
  );
}
