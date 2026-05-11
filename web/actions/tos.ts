"use server";

import { supabaseServer } from "@/lib/supabase/server";

export async function acceptAutomationTosAction(): Promise<{ error?: string }> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await sb
    .from("profiles")
    .update({ tos_automation_accepted_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    console.error("acceptAutomationTosAction failed:", error);
    return { error: "Failed to save acceptance. Please try again." };
  }
  return {};
}
