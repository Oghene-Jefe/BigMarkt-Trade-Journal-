# BigMarkt Security Hardening Checklist

Use this before inviting public vulnerability testing.

## Required Before Public Challenge

- Publish `/.well-known/security.txt` on every public app.
- Publish clear scope, safe harbor, and reporting rules.
- Add security headers on every deployed app and subdomain.
- Remove `X-Powered-By`.
- Confirm wildcard CORS is not used on authenticated or API responses.
- Confirm every state-changing route has authentication, authorization, and CSRF protection where cookie auth is used.
- Confirm signed URLs expire, are scoped to one object, and cannot be guessed or replayed beyond intended use.
- Confirm webhooks verify signatures before processing.
- Confirm admin routes are server-enforced, not only hidden in the UI.
- Confirm rate limits on auth, signup, ingestion, upload, public share, and report endpoints.
- Confirm logs and alerts exist for auth failures, privilege changes, webhook failures, ingestion spikes, and 5xx errors.

## Header Target

- `Strict-Transport-Security`
- `Content-Security-Policy`
- `X-Frame-Options` or CSP `frame-ancestors`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- no `X-Powered-By`

## CORS Target

For APIs:

- Do not use `Access-Control-Allow-Origin: *` with credentials.
- Prefer explicit origins:
  - `https://www.bigmarkt.co`
  - `https://journal.bigmarkt.co`
  - `https://club.bigmarkt.co`
  - `https://fts.bigmarkt.co`
- Return `Vary: Origin` when origin reflection is used.

