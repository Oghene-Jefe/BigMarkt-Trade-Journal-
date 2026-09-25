// Supabase email-link redirect lands here. We exchange the code for a session
// and forward to whatever page sent the user (next= search param), defaulting
// to the dashboard.
//
// Audit M-17: the original guard only blocked open-redirect / protocol-relative
// shapes (`//evil.com`) — it allowed any internal path including /admin/*,
// /api/*, or any future internal route. That made the callback a phishing
// vector: an attacker can craft a magic-link with `?next=/journal/imports`
// (or worse) and the user lands somewhere unexpected after auth.
//
// Hard allow-list now. Any `next` value that isn't in the set falls back to
// /dashboard — same default the search-param fallback uses. The list is
// intentionally short and explicit; adding routes here should be a conscious
// decision.
const ALLOWED_NEXT = new Set([
  "/dashboard",
  "/journal",
  "/profile",
  "/onboarding",
  "/reset/confirm",
]);

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Where to send someone whose link didn't work. A recovery link that fails
// has to land back on /reset with an explanation, not on the password form:
// the form can't save anything without a session, and it used to say so only
// after the user had typed a new password twice.
function failureTarget(next: string): string {
  return next === "/reset/confirm" ? "/reset?error=link" : "/login?error=link";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next");
  const next = requested && ALLOWED_NEXT.has(requested) ? requested : "/dashboard";

  // Supabase itself can reject the link before we ever see a code (expired,
  // already used, or consumed by a mail-client link preview).
  const linkError = url.searchParams.get("error") ?? url.searchParams.get("error_code");
  if (linkError) {
    console.error("[auth_callback] link rejected by Supabase:", {
      error: linkError,
      description: url.searchParams.get("error_description"),
      next,
    });
    return NextResponse.redirect(new URL(failureTarget(next), url.origin));
  }

  if (!code) {
    console.error("[auth_callback] no code on callback", { next });
    return NextResponse.redirect(new URL(failureTarget(next), url.origin));
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) {
    // The usual cause: the link was opened in a different browser or device
    // from the one that requested it, so the PKCE verifier cookie isn't here
    // and the code can't be redeemed. Previously this was swallowed and the
    // user was sent to the password form anyway.
    console.error("[auth_callback] code exchange failed:", {
      code: error.code,
      message: error.message,
      next,
    });
    return NextResponse.redirect(new URL(failureTarget(next), url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
