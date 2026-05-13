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
  const country = String(formData.get("country") ?? "").trim();
  const experience_level = String(formData.get("experience_level") ?? "").trim();
  const why_join = String(formData.get("why_join") ?? "").trim().slice(0, 500);
  const referral_source = String(formData.get("referral_source") ?? "").trim();

  if (!full_name || !email || !country || !experience_level || !why_join) {
    return { ok: false, error: "All required fields must be filled." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  try {
    const { error } = await supabaseAdmin()
      .from("bootcamp_applications")
      .insert({
        full_name,
        email,
        country,
        experience_level,
        why_join,
        referral_source: referral_source || null,
      });
    if (error) {
      return { ok: false, error: "Could not submit. Please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not submit. Please try again." };
  }
}
