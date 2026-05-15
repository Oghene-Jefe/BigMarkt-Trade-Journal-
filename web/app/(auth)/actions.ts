"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { loginSchema, signupSchema, resetRequestSchema, newPasswordSchema } from "@/lib/schemas";

export type ActionState = { error?: string; ok?: string };

export async function loginAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and a password (min 6 chars)." };

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("invalid")) return { error: "Wrong email or password." };
    if (msg.includes("not confirmed")) return { error: "Verify your email first — check your inbox." };
    return { error: "Login failed. Try again." };
  }
  redirect("/dashboard");
}

export async function signupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    website: formData.get("website"), // honeypot
    referred_by: formData.get("referred_by"),
  });
  if (!parsed.success) return { error: "Check your inputs and try again." };
  // Honeypot tripped → silently succeed (don't tell bots).
  if (parsed.data.website && parsed.data.website.length > 0) return { error: "Bot detected" };

  const sb = await supabaseServer();
  // referred_by goes into raw_user_meta_data; the handle_new_user trigger
  // (migration 0032) copies it into profiles.referred_by at insert time.
  const meta: Record<string, string> = { name: parsed.data.name };
  if (parsed.data.referred_by) meta.referred_by = parsed.data.referred_by;
  const { data, error } = await sb.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: meta },
  });
  if (error) {
    if (error.message.toLowerCase().includes("registered"))
      return { error: "This email already has an account — log in instead." };
    return { error: "Signup failed. Try again." };
  }

  // Profile row gets created by the auth trigger in 0005 (added later) OR by
  // the first authenticated request. We don't upsert from the client anymore.
  if (data.session) redirect("/dashboard");
  return { ok: `Check your inbox at ${parsed.data.email} to verify your account.` };
}

export async function logoutAction() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestResetAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: "Enter a valid email." };
  const sb = await supabaseServer();
  const origin = (await headers()).get("origin") ?? "";
  await sb.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset/confirm`,
  });
  // Don't disclose whether the email exists.
  return { ok: "If that email has an account, a reset link is on its way." };
}

export async function setNewPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };
  await sb.auth.signOut();
  redirect("/login?reset=1");
}
