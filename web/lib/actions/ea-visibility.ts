'use server'

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Shows or hides the authenticated user's EA trades on their public profile.
 * 'public'  = their Private EA trades become Public
 * 'private' = their Public EA trades become Private (default)
 * Trades set to exclude or followers_only are left alone. The previous version
 * wrote 'community', which trades_visibility_check rejects, and turning it off
 * overwrote every EA trade.
 */
export async function setEaTradesVisibility(
  visibility: "public" | "private",
): Promise<{ success: boolean; error?: string }> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const from = visibility === "public" ? "private" : "public";
  const { error } = await sb
    .from("trades")
    .update({ visibility, trade_visibility: visibility })
    .eq("user_id", user.id)
    .eq("source", "ea")
    .eq("visibility", from);

  if (error) {
    console.error("setEaTradesVisibility error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}
