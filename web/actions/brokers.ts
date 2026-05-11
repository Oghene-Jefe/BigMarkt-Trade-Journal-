"use server";

import { supabaseServer } from "@/lib/supabase/server";

export async function submitBrokerAction(formData: {
  brokerName: string;
  platform: string;
  website?: string;
  notes?: string;
}): Promise<{ error?: string }> {
  const brokerName = formData.brokerName?.trim();
  const platform = formData.platform?.trim();
  if (!brokerName || !platform) {
    return { error: "Broker name and platform are required." };
  }

  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const { error } = await sb.from("broker_submissions").insert({
    user_id: user?.id ?? null,
    broker_name: brokerName,
    platform,
    website: formData.website?.trim() || null,
    notes: formData.notes?.trim() || null,
  });

  if (error) {
    console.error("submitBrokerAction failed:", error);
    return { error: "Failed to submit. Please try again." };
  }
  return {};
}
