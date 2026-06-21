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
const VERIFY_ERR = "Verification expired — please retry.";
const DUPLICATE_ERR = "Looks like you already applied. We'll be in touch.";

// Server-side allowlists mirroring the <select> options in ApplicationForm.tsx.
const EXPERIENCE_LEVELS = ["Complete Beginner", "Some Knowledge", "Have Traded Before"];
const REFERRAL_SOURCES = ["Telegram", "X (Twitter)", "Friend", "BigMarkt", "Other"];

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
  // Cap aligned with the client maxLength (500) on the why_join textarea.
  const why_join = capStr(formData.get("why_join"), INPUT_CAPS.mediumField);
  const referral_source = capStr(formData.get("referral_source"), INPUT_CAPS.shortField);
  const turnstile = capStr(formData.get("cf-turnstile-response"), 4096);

  if (!full_name || !email || !country || !experience_level || !why_join) {
    return { ok: false, error: "All required fields must be filled." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  // Validate enumerated fields against the <select> allowlists. Reject an
  // out-of-set experience_level (required); drop an unknown referral_source.
  if (!EXPERIENCE_LEVELS.includes(experience_level)) {
    return { ok: false, error: "Please select a valid experience level." };
  }
  const referral = REFERRAL_SOURCES.includes(referral_source) ? referral_source : null;

  // 2. Bot verification (Cloudflare Turnstile). Fail-open in dev when
  //    TURNSTILE_SECRET_KEY is unset; strict in prod once configured.
  const ip = await callerIp();
  const human = await verifyTurnstile(turnstile, ip);
  if (!human) return { ok: false, error: VERIFY_ERR };

  // 3. Rate-limit + duplicate-suppression BEFORE the service-role insert.
  const admin = supabaseAdmin();
  const gate = await checkAndLog(admin, {
    scope: "fts_application",
    ip,
    email,
  });
  if (!gate.ok) {
    if (gate.reason === "duplicate") return { ok: false, error: DUPLICATE_ERR };
    return { ok: false, error: GENERIC_ERR };
  }

  try {
    const { error } = await admin
      .from("bootcamp_applications")
      .insert({
        full_name,
        email,
        country,
        experience_level,
        why_join,
        referral_source: referral,
      });
    if (error) {
      console.error("bootcamp_applications insert failed:", { scope: "fts_application", error: error.message });
      return { ok: false, error: GENERIC_ERR };
    }
    return { ok: true };
  } catch (err) {
    console.error("bootcamp_applications insert threw:", { scope: "fts_application", err });
    return { ok: false, error: GENERIC_ERR };
  }
}
