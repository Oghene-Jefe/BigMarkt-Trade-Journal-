import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Edge middleware. Two responsibilities — kept narrow:
//   1. /@username slug rewrites (anon-friendly profile URLs)
//   2. Refresh the Supabase auth-session cookie on every matched request
//
// Notably NOT responsible for: onboarding redirects, app-route auth gating,
// or any DB lookups. Those moved into the (app)/layout.tsx in audit H-12
// because:
//   • Middleware fires on every matched request (incl. assets the matcher
//     doesn't exclude), so a DB query here meant 2 round-trips per page-
//     view AND a soft-DoS surface against the connection pool.
//   • The original isAppRoute(pathname) check ran AFTER the /@slug rewrite,
//     using the pre-rewrite pathname. An attacker could send /@dashboard
//     → rewrite to /dashboard → middleware's onboarding gate skipped because
//     pathname.startsWith("/@") not "/dashboard". (app)/layout.tsx runs
//     after the rewrite hits its target route, so this bypass is closed.
//   • Onboarding state needs profile.display_name; layout already loads
//     the profile row for username derivation. Same query, no extra cost.
//
// Audit ref: docs/security-audit-2026-05-17.md H-12.

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  // /@username → /username (public profile route). Done as a rewrite so
  // the canonical share URL stays short and friendly.
  if (pathname.startsWith("/@")) {
    const slug = pathname.slice(2);
    if (slug && slug.length > 0) {
      url.pathname = "/" + slug;
      return NextResponse.rewrite(url);
    }
  }

  // Refresh the Supabase auth cookie. updateSession also surfaces the
  // server-bound supabase client, but we don't need it here anymore —
  // the layout handles auth/onboarding gating itself.
  const { response } = await updateSession(request);
  return response;
}

export const config = {
  matcher: [
    // Excludes static assets, favicon, image extensions, public share
    // routes (/p/[id]), the public /guide docs section, AND the entire
    // /api tree — API routes handle their own auth and don't need
    // session-refresh cookies.
    "/((?!api|_next/static|_next/image|favicon.ico|p/|guide/|guide$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
