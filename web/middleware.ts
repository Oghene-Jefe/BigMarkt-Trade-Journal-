import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routes under the (app) shell that require a completed profile. Onboarding
// is considered complete the moment profile.display_name is non-null.
const APP_ROUTE_PREFIXES = [
  "/dashboard",
  "/journal",
  "/trades",
  "/analytics",
  "/challenges",
  "/leaderboard",
  "/subscriptions",
  "/brokers",
  "/accounts",
  "/ea-setup",
  "/exchanges",
  "/profile",
  "/admin",
  "/notifications",
  "/disputes",
];

function isAppRoute(pathname: string): boolean {
  return APP_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const pathname = url.pathname;

  if (pathname.startsWith("/@")) {
    const slug = pathname.slice(2);
    if (slug && slug.length > 0) {
      url.pathname = "/" + slug;
      return NextResponse.rewrite(url);
    }
  }

  const { supabase, response } = await updateSession(request);

  if (isAppRoute(pathname)) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.display_name) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/onboarding";
        return NextResponse.redirect(redirectUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|p/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
