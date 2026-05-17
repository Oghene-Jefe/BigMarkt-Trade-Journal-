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

const GENERIC_ERR = "Could not submit. Please try again later.";

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const full_name = capStr(formData.get("full_name"), INPUT_CAPS.name);
  const email = capStr(formData.get("email"), INPUT_CAPS.email).toLowerCase();
  const university = capStr(formData.get("university"), INPUT_CAPS.shortField);
  const country = capStr(formData.get("country"), INPUT_CAPS.shortField);
  const track_interest = capStr(formData.get("track_interest"), INPUT_CAPS.shortField);
  const application_type =
    capStr(formData.get("application_type"), INPUT_CAPS.shortField) || "member";
  const referral_source = capStr(formData.get("referral_source"), INPUT_CAPS.shortField);
  const why_join = capStr(formData.get("why_join"), INPUT_CAPS.longField);
  const turnstile = capStr(formData.get("cf-turnstile-response"), 4096);

  if (!full_name || !email || !university || !country || !why_join) {
    return { ok: false, error: "All required fields must be filled." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const ip = await callerIp();
  const human = await verifyTurnstile(turnstile, ip);
  if (!human) return { ok: false, error: GENERIC_ERR };

  const admin = supabaseAdmin();
  const gate = await checkAndLog(admin, {
    scope: "club_application",
    ip,
    email,
  });
  if (!gate.ok) return { ok: false, error: GENERIC_ERR };

  try {
    const { error } = await admin
      .from("club_applications")
      .insert({
        full_name,
        email,
        university,
        country,
        track_interest: track_interest || null,
        application_type,
        referral_source: referral_source || null,
        why_join,
      });
    if (error) return { ok: false, error: GENERIC_ERR };
    return { ok: true };
  } catch {
    return { ok: false, error: GENERIC_ERR };
  }
}
