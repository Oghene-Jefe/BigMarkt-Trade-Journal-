"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  INPUT_CAPS,
  callerIp,
  capStr,
  checkAndLog,
  verifyTurnstile,
} from "@/lib/abuse";

export type ApplicationState = {
  ok: boolean;
  error?: string;
};

// Generic error so we never leak which check failed. Bots learn nothing from this.
const GENERIC_ERR = "Could not submit. Please try again later.";

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  // 1. Cap & extract inputs FIRST — never let an unbounded body sit in memory
  //    long enough to reach the service-role client.
  const full_name = capStr(formData.get("full_name"), INPUT_CAPS.name);
  const email = capStr(formData.get("email"), INPUT_CAPS.email).toLowerCase();
  const country = capStr(formData.get("country"), INPUT_CAPS.shortField);
  const experience_level = capStr(formData.get("experience_level"), INPUT_CAPS.shortField);
  const why_join = capStr(formData.get("why_join"), INPUT_CAPS.longField);
  const referral_source = capStr(formData.get("referral_source"), INPUT_CAPS.shortField);
  const turnstile = capStr(formData.get("cf-turnstile-response"), 4096);

  if (!full_name || !email || !country || !experience_level || !why_join) {
    return { ok: false, error: "All required fields must be filled." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  // 2. Bot verification (Cloudflare Turnstile). Fail-open in dev when
  //    TURNSTILE_SECRET_KEY is unset; strict in prod once configured.
  const ip = await callerIp();
  const human = await verifyTurnstile(turnstile, ip);
  if (!human) return { ok: false, error: GENERIC_ERR };

  // 3. Rate-limit + duplicate-suppression BEFORE the service-role insert.
  const admin = supabaseAdmin();
  const gate = await checkAndLog(admin, {
    scope: "fts_application",
    ip,
    email,
  });
  if (!gate.ok) return { ok: false, error: GENERIC_ERR };

  try {
    const { error } = await admin
      .from("bootcamp_applications")
      .insert({
        full_name,
        email,
        country,
        experience_level,
        why_join,
        referral_source: referral_source || null,
      });
    if (error) return { ok: false, error: GENERIC_ERR };
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERR };
  }
}
