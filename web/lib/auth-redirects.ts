// Shared by the two places an email link can land:
//   /auth/callback — PKCE, exchanges ?code for a session. Only works in the
//                    browser that asked for the link (it holds the verifier).
//   /auth/confirm  — verifies ?token_hash, so it works in any browser.
//
// Audit M-17 (kept): `next` is a hard allow-list. Any other value falls back
// to /dashboard, so a crafted link can't drop someone on an arbitrary internal
// route. Adding to this list should be a conscious decision.
export const ALLOWED_NEXT = new Set([
  "/dashboard",
  "/journal",
  "/profile",
  "/onboarding",
  "/reset/confirm",
]);

/** The mobile app's deep link. Recovery links for the app are handed over to it. */
export const APP_CALLBACK = "bigmarkt://auth-callback";

/**
 * Exact match only (a query string is allowed). Matching the whole scheme would
 * let a crafted link bounce a live token to any bigmarkt:// path.
 */
export function isAppCallback(redirectTo: string | null): boolean {
  if (!redirectTo) return false;
  return redirectTo === APP_CALLBACK || redirectTo.startsWith(`${APP_CALLBACK}?`);
}

export function safeNext(requested: string | null, fallback = "/dashboard"): string {
  if (requested && ALLOWED_NEXT.has(requested)) return requested;
  return ALLOWED_NEXT.has(fallback) ? fallback : "/dashboard";
}

/**
 * Where to send someone whose link didn't work. A recovery link that fails has
 * to land back on /reset with an explanation, not on the password form: the
 * form can't save anything without a session, and it used to say so only after
 * the user had typed a new password twice.
 */
export function failureTarget(next: string): string {
  return next === "/reset/confirm" ? "/reset?error=link" : "/login?error=link";
}
