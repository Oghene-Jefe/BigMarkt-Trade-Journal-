"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { tradeSchema, tradeVisibility } from "@/lib/schemas";
import { updateChallengeStreak } from "@/lib/challengeStreak";

export type TradeActionState = { error?: string; ok?: string; fieldErrors?: Record<string, string> };

const MAX_CHART_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

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

// Returns { path } if a valid file was attached, null if no file, or { error }.
async function uploadChartIfPresent(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  userId: string,
  tradeId: string,
  file: File | null,
): Promise<{ path: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;
  if (file.size > MAX_CHART_BYTES) return { error: "Chart too large (5 MB max)." };
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return { error: "Chart must be a JPEG/PNG/WebP/GIF image." };

  const extByType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  const safeExt = extByType[file.type] ?? "png";
  const path = `${userId}/${tradeId}/chart-${Date.now()}.${safeExt}`;

  const { error } = await sb.storage
    .from("trade-charts")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { error: `Chart upload failed: ${error.message}` };
  return { path };
}

export async function createTradeAction(_: TradeActionState, fd: FormData): Promise<TradeActionState> {
  const parsed = parseTradeForm(fd);
  if (!parsed.success) return { error: "Check your inputs.", fieldErrors: fieldErrorsFromZod(parsed.error) };

  const { sb, user } = await requireUser();

  const { entry_price, exit_price, stop_loss, direction } = parsed.data;
  void direction;
  let rr_ratio: number | null = null;
  if (entry_price != null && exit_price != null && stop_loss != null && stop_loss !== entry_price) {
    const risk = Math.abs(entry_price - stop_loss);
    const reward = Math.abs(exit_price - entry_price);
    rr_ratio = parseFloat((reward / risk).toFixed(2));
  }

  const insertRow = { ...parsed.data, rr_ratio, user_id: user.id, trade_visibility: parsed.data.visibility };
  const { data: inserted, error } = await sb.from("trades").insert(insertRow).select("id").single();
  if (error || !inserted) return { error: error?.message ?? "Failed to save trade." };

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

  revalidatePath("/journal");
  revalidatePath("/dashboard");
  redirect("/journal");
}

export async function updateTradeAction(id: string, _: TradeActionState, fd: FormData): Promise<TradeActionState> {
  const parsed = parseTradeForm(fd);
  if (!parsed.success) return { error: "Check your inputs.", fieldErrors: fieldErrorsFromZod(parsed.error) };

  const { sb, user } = await requireUser();
  const { data: existingTrade, error: existingTradeError } = await sb.from("trades")
    .select("core_fields_locked")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingTradeError) return { error: existingTradeError.message };
  if (!existingTrade) return { error: "Trade not found." };

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
  const updateRow: Record<string, unknown> = existingTrade.core_fields_locked
    ? editableMetadata
    : { ...parsed.data, rr_ratio, trade_visibility: parsed.data.visibility };

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
  if (error) return { error: error.message };

  revalidatePath("/journal");
  revalidatePath("/dashboard");
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
