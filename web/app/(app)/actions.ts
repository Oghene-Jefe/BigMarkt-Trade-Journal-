"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { tradeSchema, tradeVisibility } from "@/lib/schemas";

export type TradeActionState = { error?: string; ok?: string; fieldErrors?: Record<string, string> };

// FormData → tradeSchema input. Numeric fields come in as strings; we coerce
// here so the schema can stay strictly numeric and reject invalid values.
function parseTradeForm(fd: FormData) {
  const num = (k: string) => {
    const v = fd.get(k);
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const str = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  return tradeSchema.safeParse({
    pair: fd.get("pair"),
    direction: fd.get("direction"),
    result: fd.get("result"),
    pnl: num("pnl") ?? 0,
    rr_ratio: num("rr_ratio"),
    entry_price: num("entry_price"),
    exit_price: num("exit_price"),
    stop_loss: num("stop_loss"),
    take_profit: num("take_profit"),
    lot_size: num("lot_size"),
    session: str("session"),
    emotions: str("emotions"),
    strategy: str("strategy"),
    setup_grade: str("setup_grade"),
    tags: str("tags"),
    notes: str("notes"),
    visibility: fd.get("visibility") || "private",
  });
}

function fieldErrorsFromZod(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

export async function createTradeAction(_: TradeActionState, fd: FormData): Promise<TradeActionState> {
  const parsed = parseTradeForm(fd);
  if (!parsed.success) return { error: "Check your inputs.", fieldErrors: fieldErrorsFromZod(parsed.error) };

  const { sb, user } = await requireUser();
  // Mirror visibility into the legacy `trade_visibility` column so the old
  // static app at the repo root keeps working until cutover.
  const row = { ...parsed.data, user_id: user.id, trade_visibility: parsed.data.visibility };
  const { error } = await sb.from("trades").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  redirect("/journal");
}

export async function updateTradeAction(id: string, _: TradeActionState, fd: FormData): Promise<TradeActionState> {
  const parsed = parseTradeForm(fd);
  if (!parsed.success) return { error: "Check your inputs.", fieldErrors: fieldErrorsFromZod(parsed.error) };

  const { sb, user } = await requireUser();
  const row = { ...parsed.data, trade_visibility: parsed.data.visibility };
  // RLS already restricts to user_id = auth.uid(); the explicit eq is defence-in-depth.
  const { error } = await sb.from("trades").update(row).eq("id", id).eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  redirect("/journal");
}

export async function deleteTradeAction(id: string) {
  const { sb, user } = await requireUser();
  await sb.from("trades").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/journal");
  revalidatePath("/dashboard");
}

const visibilitySchema = z.object({ id: z.string().uuid(), visibility: tradeVisibility });

export async function setTradeVisibilityAction(fd: FormData) {
  const parsed = visibilitySchema.safeParse({
    id: fd.get("id"),
    visibility: fd.get("visibility"),
  });
  if (!parsed.success) return;

  const { sb, user } = await requireUser();
  await sb.from("trades")
    .update({ visibility: parsed.data.visibility, trade_visibility: parsed.data.visibility })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);
  revalidatePath("/journal");
}
