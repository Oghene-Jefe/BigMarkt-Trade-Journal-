// Refreshes the Supabase session on every request so server components
// always see a valid auth.uid(). Cookies are written back on the response.
// Returns both the response and the supabase client so callers can run
// additional auth-aware checks (e.g. onboarding gate) without rebuilding it.
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionContext = {
  supabase: SupabaseClient;
  response: NextResponse;
};

export async function updateSession(request: NextRequest): Promise<SessionContext> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) => {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touching getUser() forces a refresh if the access token is stale.
  await supabase.auth.getUser();
  return { supabase, response };
}
