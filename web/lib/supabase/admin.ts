// Service-role Supabase client. Bypasses RLS — use ONLY in server-side
// routes that perform their own authentication (e.g. the EA ingest endpoint,
// which authenticates via a sha256-hashed bearer token instead of a user
// session cookie). Never import this from client code or from routes that
// should run as the calling user.
//
// `server-only` makes accidental client import a build error rather than a
// silent inlining of process.env.SUPABASE_SERVICE_ROLE_KEY into the client
// bundle. Closes audit finding H-13.
import "server-only";
import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("supabaseAdmin: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
