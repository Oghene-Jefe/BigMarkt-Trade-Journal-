"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { safeDbError } from "@/lib/db-error";

export type WaitlistActionState = { error?: string; ok?: string };

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

export async function joinProWaitlistAction(
  _: WaitlistActionState,
  _fd: FormData,
): Promise<WaitlistActionState> {
  const { sb, user } = await requireUser();

  // Idempotent: only stamp the timestamp when it's not already set, so a
  // second click never overwrites the original interest time. If the row
  // is already stamped the WHERE matches nothing — that's success, not an
  // error.
  const { error } = await sb
    .from("profiles")
    .update({ pro_interest_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("pro_interest_at", null);

  if (error) return { error: safeDbError(error, "Couldn't join the waitlist.", "pro_waitlist") };

  revalidatePath("/upgrade");
  return { ok: "You're on the list." };
}

export async function leaveProWaitlistAction(
  _: WaitlistActionState,
  _fd: FormData,
): Promise<WaitlistActionState> {
  const { sb, user } = await requireUser();

  const { error } = await sb
    .from("profiles")
    .update({ pro_interest_at: null })
    .eq("id", user.id);

  if (error) return { error: safeDbError(error, "Couldn't update the waitlist.", "pro_waitlist") };

  revalidatePath("/upgrade");
  return { ok: "Removed from the waitlist." };
}
