// Browser Supabase client. Reads/writes the auth cookie that the server
// route handlers and Server Components also see — this is what makes RLS
// work end-to-end without ever putting tokens in localStorage.
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
