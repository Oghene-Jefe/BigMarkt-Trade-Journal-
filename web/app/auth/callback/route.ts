// Supabase email-link redirect lands here. We exchange the code for a session
// and forward to whatever page sent the user (next= search param), defaulting
// to the dashboard.
//
// This is the PKCE half of the pair: ?code can only be redeemed by the browser
// that requested the link. Links that carry a token hash go to /auth/confirm
// instead, which works on any device. The allow-list for `next` and the
// failure targets are shared between the two (lib/auth-redirects.ts).
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { failureTarget, safeNext } from "@/lib/auth-redirects";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

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
