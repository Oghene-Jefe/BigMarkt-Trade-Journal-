// Shared abuse-protection primitives for public form submissions.
// DB-backed via the `abuse_log` table (migration 0040). All checks run
// BEFORE any service-role insert into the target table.

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// ── caps ─────────────────────────────────────────────────────────────────────

export const INPUT_CAPS = {
  name: 120,
  email: 254,        // RFC 5321 max
  shortField: 120,   // country / university / platform / experience_level
  longField: 800,    // why_join, notes, free-text reasons
  mediumField: 500,  // catch-all
  url: 500,
} as const;

/** Hard-cap a string after trimming; returns the trimmed/truncated value. */
export function capStr(raw: FormDataEntryValue | null | undefined, max: number): string {
  return String(raw ?? "").trim().slice(0, max);
}

// ── ip extraction ────────────────────────────────────────────────────────────

/** Best-effort IP from request headers. May be null behind opaque proxies. */
export async function callerIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get("x-forwarded-for") ?? "";
  // x-forwarded-for is comma-separated; the left-most is the original client.
  const first = xff.split(",")[0]?.trim();
  if (first) return first;
  return h.get("x-real-ip") ?? null;
}

// ── turnstile ────────────────────────────────────────────────────────────────

/**
 * Verify a Cloudflare Turnstile token. Returns true if the token is valid
 * OR if Turnstile is not configured (env var unset) — the latter so local
 * dev keeps working. In production set TURNSTILE_SECRET_KEY in the
 * marketing-site Vercel project to enforce.
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  // Fail-CLOSED in production: a misconfigured prod env (missing secret)
  // must not silently disable the bot check. In dev/test we still
  // fail-open so local work doesn't require Cloudflare creds.
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!res.ok) return false;
    const json: { success?: boolean } = await res.json();
    return Boolean(json.success);
  } catch {
    return false;
  }
}

// ── rate-limit / duplicate suppression ───────────────────────────────────────

export type RateCheckArgs = {
  scope: string;            // unique per form, e.g. 'fts_application'
  ip: string | null;
  email: string | null;
  /** Max submissions from the same IP in the window. Default 5 / hour. */
  ipLimit?: number;
  /** Window length for the IP cap, in seconds. Default 3600. */
  ipWindowSec?: number;
  /** Window for treating identical-email submissions as duplicates. Default 24h. */
  dedupeWindowSec?: number;
};

export type RateCheckResult =
  | { ok: true }
  | { ok: false; reason: "rate_limited" | "duplicate" };

/**
 * Check IP rate + email duplicate, then log this attempt. Logging always
 * happens last so a failing request still consumes its slot.
 */
export async function checkAndLog(
  admin: SupabaseClient,
  args: RateCheckArgs,
): Promise<RateCheckResult> {
  const {
    scope,
    ip,
    email,
    ipLimit = 5,
    ipWindowSec = 3600,
    dedupeWindowSec = 86400,
  } = args;

  // IP rate cap
  if (ip) {
    const since = new Date(Date.now() - ipWindowSec * 1000).toISOString();
    const { count } = await admin
      .from("abuse_log")
      .select("id", { head: true, count: "exact" })
      .eq("scope", scope)
      .eq("ip", ip)
      .gte("created_at", since);
    if ((count ?? 0) >= ipLimit) {
      await admin.from("abuse_log").insert({ scope, ip, email });
      return { ok: false, reason: "rate_limited" };
    }
  }

  // Email duplicate suppression
  if (email) {
    const since = new Date(Date.now() - dedupeWindowSec * 1000).toISOString();
    const { count } = await admin
      .from("abuse_log")
      .select("id", { head: true, count: "exact" })
      .eq("scope", scope)
      .eq("email", email)
      .gte("created_at", since);
    if ((count ?? 0) >= 1) {
      await admin.from("abuse_log").insert({ scope, ip, email });
      return { ok: false, reason: "duplicate" };
    }
  }

  await admin.from("abuse_log").insert({ scope, ip, email });
  return { ok: true };
}
