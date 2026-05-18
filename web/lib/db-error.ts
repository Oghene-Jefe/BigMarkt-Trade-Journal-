// Safe error-handling helper for Supabase / PostgREST responses returned to
// the client.
//
// Audit M-5: server actions across the (auth), (app)/profile,
// (app)/balance, (app)/admin, lib/actions/* surfaces routinely returned
// `error.message` verbatim to the client. Postgres / PostgREST error
// messages typically include table names, column names, RLS-policy
// names, and constraint definitions — all reconnaissance fuel for a
// future RLS-bypass attempt. Replace those direct returns with this
// helper, which logs the full error server-side (for ops) and returns
// a single safe string to the client.
//
// `server-only` guards against accidental client-bundle import — the
// console.error sink is server-only behaviour.

import "server-only";

/**
 * Sanitise a database error into a user-facing string.
 *
 * Logs the full error object server-side under a structured tag for
 * ops grepping, returns the provided fallback message to the caller.
 * Never echoes raw `error.message` / `error.details` / `error.hint`.
 *
 * Optional `tag` lets the caller group log entries by action name,
 * useful when grepping incidents.
 *
 * Future extension: map well-known Postgres SQLSTATE codes to
 * specific user messages (23505 → "Already exists", 23514 → "Invalid
 * value", 23502 → "Required field missing", etc.). For now, single
 * fallback is fine — the audit's concern is disclosure, not UX.
 *
 * Example:
 *   const { error } = await sb.from("profiles").update(...).eq("id", uid);
 *   if (error) return { error: safeDbError(error, "Couldn't save profile.", "profile_update") };
 */
export function safeDbError(
  err: unknown,
  fallback: string,
  tag = "db_error",
): string {
  const e = err as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;
  console.error(`[${tag}]`, {
    code: e?.code ?? null,
    message: e?.message ?? null,
    // details + hint deliberately included server-side because they
    // help ops diagnose. They never leave this function.
    details: e?.details ?? null,
    hint: e?.hint ?? null,
  });
  return fallback;
}
