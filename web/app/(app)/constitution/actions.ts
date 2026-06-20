"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { safeDbError } from "@/lib/db-error";

export type ConstitutionActionState = { error?: string; ok?: string };

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

const customRuleSchema = z.object({
  id: z.string().min(1).max(64),
  text: z.string().min(1).max(280).transform((s) => s.trim()),
});

// All rule fields are optional/nullable — a null value means the rule is OFF.
const schema = z.object({
  is_active: z.boolean(),
  max_risk_pct: z.number().positive().max(100).nullable(),
  require_stop_loss: z.boolean(),
  max_trades_per_day: z.number().int().positive().max(1000).nullable(),
  allowed_instruments: z.array(z.string().min(1).max(40)).nullable(),
  min_rr: z.number().positive().max(100).nullable(),
  max_daily_loss_pct: z.number().positive().max(100).nullable(),
  risk_mode: z.enum(["trailing", "static"]),
  risk_baseline: z.number().positive().nullable(),
  adherence_visibility: z.enum(["private", "public"]),
  custom_rules: z.array(customRuleSchema).max(50),
});

// "" / null → null; otherwise a finite Number (NaN → null).
function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function jsonArray(v: FormDataEntryValue | null): unknown[] {
  if (typeof v !== "string" || !v.trim()) return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function upsertConstitutionAction(
  _: ConstitutionActionState,
  fd: FormData,
): Promise<ConstitutionActionState> {
  const instruments = jsonArray(fd.get("allowed_instruments")).filter(
    (x): x is string => typeof x === "string",
  );

  const parsed = schema.safeParse({
    is_active: fd.get("is_active") === "on" || fd.get("is_active") === "true",
    max_risk_pct: numOrNull(fd.get("max_risk_pct")),
    require_stop_loss: fd.get("require_stop_loss") === "on" || fd.get("require_stop_loss") === "true",
    max_trades_per_day: numOrNull(fd.get("max_trades_per_day")),
    allowed_instruments: instruments.length > 0 ? instruments : null,
    min_rr: numOrNull(fd.get("min_rr")),
    max_daily_loss_pct: numOrNull(fd.get("max_daily_loss_pct")),
    risk_mode: fd.get("risk_mode") === "static" ? "static" : "trailing",
    risk_baseline: numOrNull(fd.get("risk_baseline")),
    adherence_visibility: fd.get("adherence_visibility") === "public" ? "public" : "private",
    custom_rules: jsonArray(fd.get("custom_rules")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your inputs." };
  }

  const { sb, user } = await requireUser();

  // risk_baseline only applies to static mode — null it out otherwise so a
  // stale value can't leak into a trailing-mode preview/engine run.
  const riskBaseline = parsed.data.risk_mode === "static" ? parsed.data.risk_baseline : null;

  const { error } = await sb
    .from("trading_constitutions")
    .upsert(
      {
        user_id: user.id,
        is_active: parsed.data.is_active,
        max_risk_pct: parsed.data.max_risk_pct,
        require_stop_loss: parsed.data.require_stop_loss,
        max_trades_per_day: parsed.data.max_trades_per_day,
        allowed_instruments: parsed.data.allowed_instruments,
        min_rr: parsed.data.min_rr,
        max_daily_loss_pct: parsed.data.max_daily_loss_pct,
        risk_mode: parsed.data.risk_mode,
        risk_baseline: riskBaseline,
        adherence_visibility: parsed.data.adherence_visibility,
        custom_rules: parsed.data.custom_rules,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    return { error: safeDbError(error, "Couldn't save your constitution.", "constitution_upsert") };
  }

  revalidatePath("/constitution");
  return { ok: "Constitution saved." };
}
