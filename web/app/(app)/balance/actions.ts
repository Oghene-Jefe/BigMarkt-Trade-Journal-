"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { balanceResetSchema } from "@/lib/schemas";

export type BalanceActionState = { error?: string; ok?: string };

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

export async function createBalanceResetAction(_: BalanceActionState, fd: FormData): Promise<BalanceActionState> {
  const newBal = Number(fd.get("new_balance"));
  const parsed = balanceResetSchema.safeParse({
    new_balance: Number.isFinite(newBal) ? newBal : NaN,
    reason: fd.get("reason") || null,
  });
  if (!parsed.success) return { error: "Enter a positive new balance." };

  const { sb, user } = await requireUser();
  // Snapshot current starting_balance into previous_balance, then overwrite.
  const { data: profile } = await sb.from("profiles")
    .select("starting_balance").eq("id", user.id).maybeSingle();
  const previous = profile?.starting_balance ?? null;

  const { error: insErr } = await sb.from("balance_resets").insert({
    user_id: user.id,
    previous_balance: previous,
    new_balance: parsed.data.new_balance,
    reason: parsed.data.reason,
    reset_date: new Date().toISOString().slice(0, 10),
  });
  if (insErr) return { error: insErr.message };

  const { error: upErr } = await sb.from("profiles")
    .upsert({ id: user.id, email: user.email, starting_balance: parsed.data.new_balance });
  if (upErr) return { error: upErr.message };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { ok: "Balance reset recorded." };
}
