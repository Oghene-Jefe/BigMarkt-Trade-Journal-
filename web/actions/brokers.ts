"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  INPUT_CAPS,
  callerIp,
  capStr,
  checkAndLog,
  verifyTurnstile,
} from "@/lib/abuse";

const GENERIC_ERR = "Could not submit. Please try again later.";

export async function submitBrokerAction(formData: {
  brokerName: string;
  platform: string;
  website?: string;
  notes?: string;
  turnstileToken?: string;
}): Promise<{ error?: string }> {
  // Input caps applied before anything else touches the DB.
  const brokerName = capStr(formData.brokerName, INPUT_CAPS.name);
  const platform = capStr(formData.platform, INPUT_CAPS.shortField);
  const website = capStr(formData.website, INPUT_CAPS.url);
  const notes = capStr(formData.notes, INPUT_CAPS.mediumField);
  const turnstile = capStr(formData.turnstileToken, 4096);

  if (!brokerName || !platform) {
    return { error: "Broker name and platform are required." };
  }
  if (website && !/^https?:\/\//i.test(website)) {
    return { error: "Website must start with http:// or https://" };
  }

  // Authenticated user gets a higher effective limit because we can also
  // attribute spam to a user id. We still rate-limit by IP though — a
  // single compromised account can otherwise hammer the queue.
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const ip = await callerIp();

  // Bot check + abuse-log gate run against the admin client (the abuse_log
  // table is service-role only).
  const admin = supabaseAdmin();
  const human = await verifyTurnstile(turnstile, ip);
  if (!human) return { error: GENERIC_ERR };

  const gate = await checkAndLog(admin, {
    scope: "broker_submission",
    ip,
    email: user?.email ?? null,
    // Authenticated users: looser cap; anonymous: tighter.
    ipLimit: user ? 10 : 3,
    ipWindowSec: 3600,
    dedupeWindowSec: user ? 600 : 86400, // dedupe identical broker spam tightly for logged-out
  });
  if (!gate.ok) return { error: GENERIC_ERR };

  const { error } = await sb.from("broker_submissions").insert({
    user_id: user?.id ?? null,
    broker_name: brokerName,
    platform,
    website: website || null,
    notes: notes || null,
  });

  if (error) {
    console.error("submitBrokerAction failed:", error);
    return { error: GENERIC_ERR };
  }
  return {};
}
