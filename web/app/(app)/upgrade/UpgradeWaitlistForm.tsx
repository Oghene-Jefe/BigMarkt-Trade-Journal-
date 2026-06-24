"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import {
  joinProWaitlistAction,
  leaveProWaitlistAction,
  type WaitlistActionState,
} from "./actions";

export function UpgradeWaitlistForm() {
  const [state, formAction, pending] = useActionState<WaitlistActionState, FormData>(
    joinProWaitlistAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-sm text-muted">
        Be first to know when Pro launches. No payment now.
      </p>
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "Joining…" : "Join the waitlist"}
      </Button>
      {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}
    </form>
  );
}

export function LeaveWaitlistForm() {
  const [state, formAction, pending] = useActionState<WaitlistActionState, FormData>(
    leaveProWaitlistAction,
    {},
  );

  return (
    <form action={formAction} className="space-y-2">
      <Button type="submit" variant="secondary" size="sm" disabled={pending}>
        {pending ? "Removing…" : "Leave waitlist"}
      </Button>
      {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}
    </form>
  );
}
