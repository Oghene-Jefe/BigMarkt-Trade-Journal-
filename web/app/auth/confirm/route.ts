// Email links that carry a token hash land here.
//
// Why this exists: /auth/callback uses PKCE, so its ?code can only be redeemed
// by the browser that requested the link — the verifier is a cookie there. Ask
// for a reset on a laptop, open the mail on a phone, and the exchange fails.
// That lost a real reset on 2026-09-25. A token hash carries no such tie, so
// verifying it here works on any device.
//
// The recovery email template points at this route:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
//     &next=/reset/confirm&redirect_to={{ .RedirectTo }}
//
// ?code is still accepted so a template that hasn't been updated yet, or any
// other Supabase link pointed here, keeps working.
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { failureTarget, isAppCallback, safeNext } from "@/lib/auth-redirects";

const VERIFIABLE: EmailOtpType[] = ["recovery", "signup", "invite", "magiclink", "email", "email_change"];

function isVerifiable(type: string | null): type is EmailOtpType {
  return !!type && (VERIFIABLE as string[]).includes(type);
}

/**
 * The app keeps its session in its own storage, so it has to verify the token
 * itself — burning it here would sign in a browser the trader isn't using.
 * A server redirect to a custom scheme is unreliable (Safari in particular),
 * so hand over with a page that tries the deep link and offers a button.
 */
function handOverToApp(redirectTo: string, tokenHash: string, type: EmailOtpType): NextResponse {
  const target = `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}token_hash=${encodeURIComponent(
    tokenHash,
  )}&type=${encodeURIComponent(type)}`;
  const attr = target.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="robots" content="noindex">
<title>Open BigMarkt</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#0b0b0c; color:#f4f4f5; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; padding:24px; }
  .card { max-width:22rem; text-align:center; }
  h1 { font-size:1.25rem; margin:0 0 .75rem; }
  p { color:#a1a1aa; font-size:.9375rem; line-height:1.5; margin:0 0 1.25rem; }
  a.btn { display:block; background:#d4af37; color:#000; text-decoration:none; font-weight:600;
          padding:.875rem 1rem; border-radius:.5rem; }
</style>
</head>
<body>
  <div class="card">
    <h1>Opening the BigMarkt app</h1>
    <p>If nothing happens, tap the button below on the phone where BigMarkt is installed.</p>
    <a class="btn" href="${attr}">Open the BigMarkt app</a>
  </div>
  <!-- After the fallback has painted: a browser that can't handle the scheme
       otherwise leaves a blank page instead of the button. -->
  <script>setTimeout(function () { window.location.href = ${JSON.stringify(target)}; }, 400);</script>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const redirectTo = url.searchParams.get("redirect_to");
  const next = safeNext(url.searchParams.get("next"), type === "recovery" ? "/reset/confirm" : "/dashboard");

  // Supabase can reject the link before it ever reaches us.
  const linkError = url.searchParams.get("error") ?? url.searchParams.get("error_code");
  if (linkError) {
    console.error("[auth_confirm] link rejected by Supabase:", {
      error: linkError,
      description: url.searchParams.get("error_description"),
      next,
    });
    return NextResponse.redirect(new URL(failureTarget(next), url.origin));
  }

  const sb = await supabaseServer();

  if (tokenHash) {
    if (!isVerifiable(type)) {
      console.error("[auth_confirm] unusable link type:", { type, next });
      return NextResponse.redirect(new URL(failureTarget(next), url.origin));
    }
    if (isAppCallback(redirectTo)) return handOverToApp(redirectTo!, tokenHash, type);

    const { error } = await sb.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      // Expired, already used, or consumed by a mail-client link preview.
      console.error("[auth_confirm] verifyOtp failed:", { code: error.code, message: error.message, type, next });
      return NextResponse.redirect(new URL(failureTarget(next), url.origin));
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("[auth_confirm] code exchange failed:", { code: error.code, message: error.message, next });
      return NextResponse.redirect(new URL(failureTarget(next), url.origin));
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  console.error("[auth_confirm] link carried neither token_hash nor code", { next });
  return NextResponse.redirect(new URL(failureTarget(next), url.origin));
}
