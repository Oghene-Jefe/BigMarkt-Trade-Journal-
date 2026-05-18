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

  // Verification-email destination. Without this, Supabase falls back to
  // the project's "Site URL" setting in the dashboard — which currently
  // points at https://bigmarkt.co (the marketing site, no auth handling)
  // so verified users land on the marketing home page and nothing
  // happens. Pin the redirect to the journal's /auth/callback so it
  // exchanges the code for a session and forwards the user to the
  // dashboard — where (app)/layout.tsx picks them up, sees an empty
  // profile, and forwards to /onboarding (H-12 onboarding gate).
  //
  // trustedAppOrigin() is the same env-locked allow-list the password
  // reset uses; it can't be tricked by an `Origin:` header on the
  // signup request.
  let origin: string;
  try {
    origin = trustedAppOrigin();
  } catch (e) {
    console.error("signupAction trustedAppOrigin failed:", e);
    return { error: "Signup failed. Try again." };
  }

  const { data, error } = await sb.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: meta,
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });
  if (error) {
    // Other Supabase auth errors (rate-limited, weak password rejected
    // by server-side policy, etc.) collapse into a single generic
    // message — same shape as the H-10 login closure.
    console.error("signupAction signUp failed:", { code: error.code, message: error.message });
    return { error: "Signup failed. Try again." };
  }

  // Supabase anti-enumeration behavior: when an existing email tries to
  // sign up again, signUp() returns a "fake" user object with an empty
  // `identities` array AND no error. That's how Supabase prevents the
  // login-form-style enumeration oracle on signup.
  //
  // N-H6 / UX-tradeoff note: the original audit recommendation was to
  // KEEP the silent behavior so an attacker can't probe which emails
  // are registered. But real users hitting "Check your inbox at X"
  // when X already has an account and never receiving an email is a
  // confusing dead-end — they assume the form is broken. Product
  // decision (2026-05-18): explicitly surface "email already has an
  // account" on this branch. Email enumeration is currently mitigated
  // by Turnstile; the signup abuse_log gate is tracked as the N-M11
  // follow-up. Documented re-opening in
  // docs/security-audit-2026-05-18-rescan.md (N-H6 "Reverted for UX").
  const identities = data.user?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return { error: "This email already has an account — log in instead." };
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
