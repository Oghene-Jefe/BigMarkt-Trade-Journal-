"use client";

import { useActionState } from "react";
import { createChallengeAction, type ChallengeActionState } from "./actions";

export default function NewChallengeForm() {
  const [state, formAction, pending] = useActionState<ChallengeActionState, FormData>(
    createChallengeAction,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);
  const oneMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  return (
    <form action={formAction} className="rounded-2xl border border-white/10 bg-panel p-4">
      <p className="mb-3 text-sm text-muted">Set a profit / streak / consistency goal with a deadline.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Goal</span>
          <input
            name="goal_type"
            required
            maxLength={40}
            placeholder="Profit / 5% account / Phase 1"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Target ($)</span>
          <input
            name="goal_target"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="500"
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Start</span>
          <input
            name="start_date"
            type="date"
            required
            defaultValue={today}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">End</span>
          <input
            name="end_date"
            type="date"
            required
            defaultValue={oneMonth}
            className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
          />
        </label>
      </div>
      {state.error ? <p className="mt-2 text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="mt-2 text-sm text-win">{state.ok}</p> : null}
      <div className="mt-3 flex justify-end">
        <button
          disabled={pending}
          className="rounded-md bg-gold px-5 py-2 font-display tracking-widest text-black disabled:opacity-50"
        >
          {pending ? "CREATING…" : "NEW CHALLENGE"}
        </button>
      </div>
    </form>
  );
}
