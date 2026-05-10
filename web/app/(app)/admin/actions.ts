"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

const idSchema = z.object({ id: z.string().uuid() });

// Removes all of the target user's app data (trades, balance resets,
// challenges, profile). Storage objects (chart screenshots, avatar) are
// also removed here so we don't leave orphans. The auth.users row itself
// is intentionally left intact — see migration 0011 for rationale.
export async function adminPurgeUserDataAction(fd: FormData) {
  // Server-side admin check before doing any work. The RPC re-checks at
  // the database level, but failing fast here saves the storage round-trip.
  if (!(await isAdmin())) return;

  const parsed = idSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;
  const { id } = parsed.data;

  const sb = await supabaseServer();

  // Collect storage paths before the rows disappear.
  const [{ data: trades }, { data: profile }] = await Promise.all([
    sb.from("trades").select("chart_path").eq("user_id", id),
    sb.from("profiles").select("avatar_path").eq("id", id).maybeSingle(),
  ]);

  const chartPaths = (trades ?? [])
    .map((t: { chart_path: string | null }) => t.chart_path)
    .filter((p): p is string => !!p);
  if (chartPaths.length > 0) {
    await sb.storage.from("trade-charts").remove(chartPaths);
  }
  if (profile?.avatar_path) {
    await sb.storage.from("avatars").remove([profile.avatar_path]);
  }

  // Then purge the DB rows in one shot via the RPC.
  await sb.rpc("admin_purge_user_data", { target_id: id });

  revalidatePath("/admin");
}
