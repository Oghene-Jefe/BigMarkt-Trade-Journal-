"use server";

import { supabaseAdmin } from "@/lib/supabase-admin";

export type ApplicationState = {
  ok: boolean;
  error?: string;
};

export async function submitApplication(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const university = String(formData.get("university") ?? "").trim();
  const country = String(formData.get("country") ?? "").trim();
  const track_interest = String(formData.get("track_interest") ?? "").trim();
  const application_type = String(formData.get("application_type") ?? "member").trim() || "member";
  const referral_source = String(formData.get("referral_source") ?? "").trim();
  const why_join = String(formData.get("why_join") ?? "").trim().slice(0, 800);

  if (!full_name || !email || !university || !country || !why_join) {
    return { ok: false, error: "All required fields must be filled." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    const { error } = await supabaseAdmin()
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
      return { ok: false, error: "Could not submit. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not submit. Please try again." };
  }
}
