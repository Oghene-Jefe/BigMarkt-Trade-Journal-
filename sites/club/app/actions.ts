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
const DUPLICATE_ERR = "You've already applied with this email — we'll be in touch.";
const VERIFY_ERR = "Verification expired — please retry.";

const APPLICATION_TYPES = ["member", "chapter", "mentor"] as const;
const TRACK_INTERESTS = [
  "Money Foundations",
  "Investing Fundamentals",
  "Crypto & Digital Assets",
  "Business Finance",
  "Global Markets",
  "Trading Track",
] as const;
const REFERRAL_SOURCES = [
  "X (Twitter)",
  "Instagram",
  "Friend",
  "BigMarkt",
  "FTS Academy",
  "Other",
] as const;

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const full_name = capStr(formData.get("full_name"), INPUT_CAPS.name);
  const email = capStr(formData.get("email"), INPUT_CAPS.email).toLowerCase();
  const university = capStr(formData.get("university"), INPUT_CAPS.shortField);
  const country = capStr(formData.get("country"), INPUT_CAPS.shortField);
  const track_interest_raw = capStr(formData.get("track_interest"), INPUT_CAPS.shortField);
  const track_interest = (TRACK_INTERESTS as readonly string[]).includes(track_interest_raw)
    ? track_interest_raw
    : "";
  const application_type_raw = capStr(formData.get("application_type"), INPUT_CAPS.shortField);
  const application_type = (APPLICATION_TYPES as readonly string[]).includes(application_type_raw)
    ? application_type_raw
    : "member";
  const referral_source_raw = capStr(formData.get("referral_source"), INPUT_CAPS.shortField);
  const referral_source = (REFERRAL_SOURCES as readonly string[]).includes(referral_source_raw)
    ? referral_source_raw
    : "";
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
  if (!human) return { ok: false, error: VERIFY_ERR };

  const admin = supabaseAdmin();
  const gate = await checkAndLog(admin, {
    scope: "club_application",
    ip,
    email,
  });
  if (!gate.ok) {
    if (gate.reason === "duplicate") return { ok: false, error: DUPLICATE_ERR };
    return { ok: false, error: GENERIC_ERR };
  }

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
    if (error) {
      console.error("club_applications insert failed:", error.message);
      return { ok: false, error: GENERIC_ERR };
    }
    return { ok: true };
  } catch (err) {
    console.error("submitApplication unexpected error:", err);
    return { ok: false, error: GENERIC_ERR };
  }
}
