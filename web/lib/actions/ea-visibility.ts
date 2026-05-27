'use server'

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Sets visibility on all EA trades for a given user.
 * 'community' = shown on public profile
 * 'private'   = hidden from public profile (default)
 */
export async function setEaTradesVisibility(
  userId: string,
  visibility: "community" | "private",
): Promise<{ success: boolean; error?: string }> {
  const sb = await supabaseServer();
  const { error } = await sb
    .from("trades")
    .update({ visibility })
    .eq("user_id", userId)
    .eq("source", "ea");

  if (error) {
    console.error("setEaTradesVisibility error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}
