// Server-side Supabase client for Server Components, Route Handlers, and
// Server Actions. Uses the request's cookies so Postgres sees auth.uid()
// and RLS works exactly the same as in the browser. NEVER use the service
// role key here — admin operations go through SECURITY DEFINER RPCs.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              store.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies; the middleware refresh path will.
          }
        },
      },
    },
  );
}
