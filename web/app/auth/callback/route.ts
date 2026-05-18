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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next");
  const next = requested && ALLOWED_NEXT.has(requested) ? requested : "/dashboard";

  if (code) {
    const sb = await supabaseServer();
    await sb.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
