"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseServer } from "@/lib/supabase/server";
import { brokerAccountSchema } from "@/lib/schemas";
import { safeDbError } from "@/lib/db-error";

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) obj[k] = typeof v === "string" ? v : "";
  return obj;
}

function enforceModeRules(input: {
  account_type: "live" | "demo" | "prop_firm";
  journal_mode: "manual" | "automated";
}): { journal_mode: "manual" | "automated"; is_prop_firm: boolean } {
  if (input.account_type === "prop_firm") {
    return { journal_mode: "manual", is_prop_firm: true };
  }
  if (input.account_type === "demo") {
    return { journal_mode: "manual", is_prop_firm: false };
  }
  return { journal_mode: input.journal_mode, is_prop_firm: false };
}

export async function createBrokerAccountAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const user = await requireUser();
  const parsed = brokerAccountSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { journal_mode, is_prop_firm } = enforceModeRules(parsed.data);
  const sb = await supabaseServer();
  const { error } = await sb.from("broker_accounts").insert({
    user_id: user.id,
    label: parsed.data.label,
    broker_slug: parsed.data.broker_slug,
    account_type: parsed.data.account_type,
    journal_mode,
    is_prop_firm,
    account_number: parsed.data.account_number || null,
    readonly_password: parsed.data.readonly_password || null,
  });

  if (error) return { error: safeDbError(error, "Couldn't create broker account.", "broker_account_insert") };
  revalidatePath("/accounts");
}

const updateSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(50).transform((s) => s.trim()),
  account_type: z.enum(["live", "demo", "prop_firm"]),
  journal_mode: z.enum(["manual", "automated"]),
  account_number: z.string().max(60).optional().transform((s) => (s ? s.trim() : "")),
  readonly_password: z.string().max(200).optional().transform((s) => (s ? s.trim() : "")),
});

export async function updateBrokerAccountAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const user = await requireUser();
  const parsed = updateSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { journal_mode, is_prop_firm } = enforceModeRules(parsed.data);
  const sb = await supabaseServer();
  const { error } = await sb
    .from("broker_accounts")
    .update({
      label: parsed.data.label,
      account_type: parsed.data.account_type,
      journal_mode,
      is_prop_firm,
      account_number: parsed.data.account_number || null,
      readonly_password: parsed.data.readonly_password || null,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { error: safeDbError(error, "Couldn't update broker account.", "broker_account_update") };
  revalidatePath("/accounts");
}

const idSchema = z.object({ id: z.string().uuid() });

export async function deleteBrokerAccountAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const user = await requireUser();
  const parsed = idSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = await supabaseServer();
  const { error } = await sb
    .from("broker_accounts")
    .delete()
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { error: safeDbError(error, "Couldn't delete broker account.", "broker_account_delete") };
  revalidatePath("/accounts");
}

const toggleSchema = z.object({
  id: z.string().uuid(),
  is_active: z.enum(["true", "false"]).transform((v) => v === "true"),
});

export async function toggleAccountActiveAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const user = await requireUser();
  const parsed = toggleSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = await supabaseServer();
  const { error } = await sb
    .from("broker_accounts")
    .update({ is_active: parsed.data.is_active })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) return { error: safeDbError(error, "Couldn't toggle account status.", "broker_account_toggle") };
  revalidatePath("/accounts");
}
