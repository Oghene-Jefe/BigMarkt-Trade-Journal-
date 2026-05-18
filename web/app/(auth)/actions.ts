"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

// Trusted base URL for password-reset emails. Read from env at build/run
// time — NEVER from request headers — so an attacker who forges an
// `Origin:` header on the reset request cannot trick Supabase into
// emailing a reset link that points to a domain they control.
function trustedAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "";
  // Strict allow-list: must be https on a real host. Strip trailing slash.
  if (!/^https:\/\/[^\s/]+/i.test(raw)) {
    throw new Error(
      "NEXT_PUBLIC_SITE_URL (or APP_URL) must be set to the canonical https URL of the journal app",
    );
  }
  return raw.replace(/\/$/, "");
}
import { loginSchema, signupSchema, resetRequestSchema, newPasswordSchema } from "@/lib/schemas";
import { callerIp, checkAndLog, verifyTurnstile } from "@/lib/abuse";
import { supabaseAdmin } from "@/lib/supabase/admin";

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
    // Audit H-10: previous code disambiguated "invalid" (unknown email or
    // wrong password) from "not confirmed" (email exists but unverified).
    // That gave any caller a free yes/no oracle for whether an email is
    // registered — direct account enumeration via the public login form.
    // Both branches now return the same generic message; the "check your
    // inbox" hint is only surfaced on the signup-success path, where the
    // user has just submitted the email themselves.
    console.error("loginAction signIn failed:", { code: error.code, message: error.message });
    return { error: "Wrong email or password." };
  }
  redirect("/dashboard");
}

export async function signupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name"),
    website: formData.get("website"), // honeypot
    turnstile_token: formData.get("turnstile_token"),
    referred_by: formData.get("referred_by"),
  });
  if (!parsed.success) {
    // Surface the first zod issue (e.g. "Use at least 12 characters" for
    // the new L-1 password floor). None of the schema messages leak
    // account-existence info, so this is safe to show. Falls back to the
    // generic string for anything we don't have a tailored message for.
    const first = parsed.error.issues[0]?.message ?? "Check your inputs and try again.";
    return { error: first };
  }
  // Honeypot tripped → silently succeed (don't tell bots).
  if (parsed.data.website && parsed.data.website.length > 0) return { error: "Bot detected" };

  // Audit L-2: Turnstile bot check. Fails OPEN in local dev (no secret),
  // fails CLOSED in production (verifyTurnstile checks NODE_ENV).
  const ip = await callerIp();
  const human = await verifyTurnstile(parsed.data.turnstile_token, ip);
  if (!human) return { error: "Couldn't verify you're human. Please try again." };

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
    // Audit N-H6: previous code disambiguated "already registered" from
    // "everything else", giving any caller a yes/no oracle for whether an
    // email is in the system. H-10 closed the same oracle on the login
    // form; this is the symmetric closure on signup. Both branches now
    // return a single generic message.
    //
    // If the email IS already registered, Supabase still side-effects a
    // "you already have an account" email out-of-band (handled in the
    // auth.signUp internals) — that's the right channel to surface
    // duplicate-signup intent, not the form response.
    console.error("signupAction signUp failed:", { code: error.code, message: error.message });
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
  const parsed = resetRequestSchema.safeParse({
    email: formData.get("email"),
    turnstile_token: formData.get("turnstile_token"),
  });
  if (!parsed.success) return { error: "Enter a valid email." };

  // Audit N-H7: previously this endpoint had no Turnstile and no
  // rate-limit, making it a free email-bombing vector. Combined with the
  // signup enumeration oracle (N-H6) an attacker could harvest emails
  // and flood inboxes with apparently-legitimate "BigMarkt" reset
  // emails. Two layers now:
  //   1. Turnstile bot check (fails CLOSED in prod via verifyTurnstile)
  //   2. abuse_log gate: scope='password_reset', 3 reqs / IP / hour,
  //      dedupe identical-email submissions within 10 minutes.
  // We keep returning the same generic "if that email has an account…"
  // message regardless of outcome so the email-existence oracle stays
  // closed.
  const ip = await callerIp();
  const human = await verifyTurnstile(parsed.data.turnstile_token, ip);
  if (!human) return { error: "Couldn't verify you're human. Please try again." };

  const admin = supabaseAdmin();
  const gate = await checkAndLog(admin, {
    scope: "password_reset",
    ip,
    email: parsed.data.email,
    ipLimit: 3,
    ipWindowSec: 3600,
    dedupeWindowSec: 600,
  });
  // Whether the gate blocks for rate-limit, duplicate, or abuse_log
  // unavailability, we still respond with the generic success message —
  // an attacker shouldn't be able to distinguish "rate-limited" from
  // "ok we sent it" from "email doesn't exist". The server-side log
  // captures the gate reason for ops.
  if (!gate.ok) {
    console.error("[password_reset_gate]", { reason: gate.reason });
    return { ok: "If that email has an account, a reset link is on its way." };
  }

  const sb = await supabaseServer();
  let origin: string;
  try {
    origin = trustedAppOrigin();
  } catch (e) {
    // Misconfiguration: NEXT_PUBLIC_SITE_URL / APP_URL not set in this
    // env. Log server-side so ops can fix it; show a generic message
    // to the user instead of a 500. We deliberately don't leak which
    // env var is missing — that's an attacker-useful detail.
    console.error("requestResetAction trustedAppOrigin failed:", e);
    return { ok: "If that email has an account, a reset link is on its way." };
  }
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
  if (error) {
    // Audit M-6: previously this returned `error.message` verbatim, which
    // leaked Supabase auth-policy specifics ("New password should be
    // different from the old password", "Password should contain at
    // least one digit", etc.) and could confirm account existence by
    // surfacing different error shapes for different account states.
    // Log server-side; show a single generic message to the user.
    console.error("setNewPasswordAction updateUser failed:", {
      code: error.code,
      message: error.message,
    });
    return { error: "Couldn't update password. Try the reset link again or contact support." };
  }
  await sb.auth.signOut();
  redirect("/login?reset=1");
}
