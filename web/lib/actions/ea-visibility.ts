'use server'

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Sets visibility on all EA trades for the authenticated user.
 * 'community' = shown on public profile
 * 'private'   = hidden from public profile (default)
 */
export async function setEaTradesVisibility(
  visibility: "community" | "private",
): Promise<{ success: boolean; error?: string }> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await sb
    .from("trades")
    .update({ visibility })
    .eq("user_id", user.id)
    .eq("source", "ea");

  if (error) {
    console.error("setEaTradesVisibility error:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}
