"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { tradeSchema, tradeVisibility } from "@/lib/schemas";
import { updateChallengeStreak } from "@/lib/challengeStreak";
import { extForSniffedType, sniffImageType } from "@/lib/upload/imageSniff";
import { safeDbError } from "@/lib/db-error";
import { recomputeViolationsForTrade, type RecomputeTrade } from "@/lib/constitution/recompute";

// Columns the constitution engine reads. Fetched after a manual write so the
// recompute hook sees the persisted row.
const CONSTITUTION_TRADE_FIELDS =
  "id, user_id, broker_account_id, pair, entry_price, stop_loss, take_profit, lot_size, balance_at_open, open_time, close_time, pnl, status";

// Best-effort: recompute this trade's constitution violations. Wrapped so a
// failure here can NEVER break the trade-save path. The trade row is read under
// the user session (RLS confirms ownership), but the violations DELETE+INSERT
// run through the SERVICE-ROLE client — server-only writes keep violations
// tamper-proof and allow the clean delete-before-insert dedupe (there is no
// user DELETE policy on constitution_violations by design).
async function recomputeConstitution(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  tradeId: string,
  userId: string,
): Promise<void> {
  try {
    const { data: row } = await sb
      .from("trades")
      .select(CONSTITUTION_TRADE_FIELDS)
      .eq("id", tradeId)
      .eq("user_id", userId)
      .maybeSingle();
    if (row) await recomputeViolationsForTrade(supabaseAdmin(), row as RecomputeTrade);
  } catch (err) {
    console.error("constitution recompute (manual) failed — swallowed", err);
  }
}

export type TradeActionState = { error?: string; ok?: string; fieldErrors?: Record<string, string> };

const MAX_CHART_BYTES = 5 * 1024 * 1024; // 5 MB

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

// Validates that the posted broker_account_id is a uuid the user owns.
// Account membership is app-enforced this phase (no DB NOT NULL constraint).
async function resolveOwnedAccount(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  raw: FormDataEntryValue | null,
): Promise<{ id: string } | { error: string }> {
  const parsed = z.string().uuid().safeParse(typeof raw === "string" ? raw : "");
  if (!parsed.success) return { error: "Select an account for this trade." };

  const { data: account } = await sb.from("broker_accounts")
    .select("id").eq("id", parsed.data).eq("user_id", userId).maybeSingle();
  if (!account) return { error: "Selected account not found." };
  return { id: account.id };
}

// Returns { path } if a valid file was attached, null if no file, or { error }.
async function uploadChartIfPresent(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  tradeId: string,
  file: File | null,
): Promise<{ path: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_CHART_BYTES) return { error: "Chart too large (5 MB max)." };

  // Magic-byte sniff — don't trust browser-reported file.type. The detected
  // type drives both the storage Content-Type and the file extension, so a
  // spoofed .png that's really HTML/JS is rejected here.
  const sniffed = await sniffImageType(file);
  if (!sniffed) return { error: "Chart must be a JPEG, PNG, or WebP image." };

  const path = `${userId}/${tradeId}/chart-${Date.now()}.${extForSniffedType(sniffed)}`;

  const { error } = await sb.storage
    .from("trade-charts")
    .upload(path, file, { contentType: sniffed, upsert: false });
  if (error) return { error: safeDbError(error, "Chart upload failed. Try again.", "chart_upload") };
  return { path };
}

export async function createTradeAction(_: TradeActionState, fd: FormData): Promise<TradeActionState> {
  const parsed = parseTradeForm(fd);
  if (!parsed.success) return { error: "Check your inputs.", fieldErrors: fieldErrorsFromZod(parsed.error) };

  const { sb, user } = await requireUser();

  const brokerAccount = await resolveOwnedAccount(sb, user.id, fd.get("broker_account_id"));
  if ("error" in brokerAccount) {
    return { error: brokerAccount.error, fieldErrors: { broker_account_id: brokerAccount.error } };
  }

  const { entry_price, exit_price, stop_loss, direction } = parsed.data;
  void direction;
  let rr_ratio: number | null = null;
  if (entry_price != null && exit_price != null && stop_loss != null && stop_loss !== entry_price) {
    const risk = Math.abs(entry_price - stop_loss);
    const reward = Math.abs(exit_price - entry_price);
    rr_ratio = parseFloat((reward / risk).toFixed(2));
  }

  const insertRow = { ...parsed.data, rr_ratio, user_id: user.id, broker_account_id: brokerAccount.id, trade_visibility: parsed.data.visibility, source: 'manual', verified: false };
  const { data: inserted, error } = await sb.from("trades").insert(insertRow).select("id").single();
  if (error || !inserted) return { error: safeDbError(error, "Failed to save trade.", "trade_insert") };

  const file = fd.get("chart") as File | null;
  const upload = await uploadChartIfPresent(sb, user.id, inserted.id, file);
  if (upload && "error" in upload) {
    // Trade is saved without chart — surface the upload failure but don't roll back.
    return { error: upload.error };
  }
  if (upload && "path" in upload) {
    await sb.from("trades").update({ chart_path: upload.path }).eq("id", inserted.id).eq("user_id", user.id);
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    await updateChallengeStreak(sb, user.id, today);
  } catch (err) {
    console.error("updateChallengeStreak failed:", err);
  }

  await recomputeConstitution(sb, inserted.id, user.id);

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  redirect("/journal");
}

export async function updateTradeAction(id: string, _: TradeActionState, fd: FormData): Promise<TradeActionState> {
  const parsed = parseTradeForm(fd);
  if (!parsed.success) return { error: "Check your inputs.", fieldErrors: fieldErrorsFromZod(parsed.error) };

  const { sb, user } = await requireUser();
  const { data: existingTrade, error: existingTradeError } = await sb.from("trades")
    .select("core_fields_locked, capture_source")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingTradeError) return { error: safeDbError(existingTradeError, "Couldn't load trade.", "trade_lookup") };
  if (!existingTrade) return { error: "Trade not found." };

  // Manual trades may move between the user's accounts; EA trades keep theirs
  // (core is locked — the posted account is ignored).
  let brokerAccountId: string | undefined;
  if (existingTrade.capture_source !== "ea") {
    const brokerAccount = await resolveOwnedAccount(sb, user.id, fd.get("broker_account_id"));
    if ("error" in brokerAccount) {
      return { error: brokerAccount.error, fieldErrors: { broker_account_id: brokerAccount.error } };
    }
    brokerAccountId = brokerAccount.id;
  }

  const { entry_price, exit_price, stop_loss, direction } = parsed.data;
  void direction;
  let rr_ratio: number | null = null;
  if (entry_price != null && exit_price != null && stop_loss != null && stop_loss !== entry_price) {
    const risk = Math.abs(entry_price - stop_loss);
    const reward = Math.abs(exit_price - entry_price);
    rr_ratio = parseFloat((reward / risk).toFixed(2));
  }

  const editableMetadata = {
    session: parsed.data.session,
    emotions: parsed.data.emotions,
    strategy: parsed.data.strategy,
    setup_grade: parsed.data.setup_grade,
    tags: parsed.data.tags,
    notes: parsed.data.notes,
    visibility: parsed.data.visibility,
    trade_visibility: parsed.data.visibility,
  };
  // Context-only when the row is DB-locked OR it's an EA-captured trade. EA
  // trades are immutable at the core regardless of the core_fields_locked flag
  // (a pending EA order that merged may still read false), so we never attempt
  // to write their core fields — the trader can only add context.
  const contextOnly = existingTrade.core_fields_locked || existingTrade.capture_source === "ea";
  const updateRow: Record<string, unknown> = contextOnly
    ? editableMetadata
    : { ...parsed.data, rr_ratio, trade_visibility: parsed.data.visibility };

  // Apply the (verified) account only for unlocked manual trades — the locked
  // path is metadata-only and EA trades skip account resolution entirely.
  if (brokerAccountId && !contextOnly) {
    updateRow.broker_account_id = brokerAccountId;
  }

  const file = fd.get("chart") as File | null;
  if (file && file.size > 0) {
    // Look up existing chart_path so we can delete the old object after the
    // new one is in place. RLS means this query only succeeds for the owner.
    const { data: existing } = await sb.from("trades")
      .select("chart_path").eq("id", id).eq("user_id", user.id).maybeSingle();

    const upload = await uploadChartIfPresent(sb, user.id, id, file);
    if (upload && "error" in upload) return { error: upload.error };
    if (upload && "path" in upload) {
      updateRow.chart_path = upload.path;
      if (existing?.chart_path && existing.chart_path !== upload.path) {
        await sb.storage.from("trade-charts").remove([existing.chart_path]);
      }
    }
  }

  if (fd.get("remove_chart") === "1") {
    const { data: existing } = await sb.from("trades")
      .select("chart_path").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (existing?.chart_path) {
      await sb.storage.from("trade-charts").remove([existing.chart_path]);
    }
    updateRow.chart_path = null;
  }

  const { error } = await sb.from("trades").update(updateRow).eq("id", id).eq("user_id", user.id);
  if (error) return { error: safeDbError(error, "Couldn't save trade changes.", "trade_update") };

  await recomputeConstitution(sb, id, user.id);

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  revalidatePath(`/journal/${id}`);
  revalidatePath(`/journal/${id}/edit`);
  redirect("/journal");
}

export async function deleteTradeAction(id: string) {
  const { sb, user } = await requireUser();
  // Capture chart path first so we can clean up storage after the row is gone.
  const { data: existing } = await sb.from("trades")
    .select("chart_path").eq("id", id).eq("user_id", user.id).maybeSingle();

  await sb.from("trades").delete().eq("id", id).eq("user_id", user.id);
  if (existing?.chart_path) {
    await sb.storage.from("trade-charts").remove([existing.chart_path]);
  }
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
