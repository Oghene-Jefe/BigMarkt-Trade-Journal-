# Cutover: static `index.html` → Next.js app at `web/`

The Next.js rebuild lives at `web/`. Vercel needs to know to build from
that subdirectory rather than treating the repo root as a static site.

## One-time Vercel setup (do this in the dashboard)

1. Open the BigMarkt project on https://vercel.com/dashboard
2. **Settings → General → Root Directory** → set to `web` → Save
   (Vercel will auto-detect Next.js once this is set.)
3. **Settings → Environment Variables** → add for **Production**, **Preview**, and **Development** as needed:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` (from Supabase dashboard → Settings → API → Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon JWT (Supabase dashboard → Settings → API → anon public key) |
   | `NEXT_PUBLIC_SITE_URL` | canonical journal origin, e.g. `https://journal.bigmarkt.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role JWT, server-only/sensitive |
   | `CRON_SECRET` | long random string for Vercel cron routes |
   | `WS_STATUS_URL` | Railway `/status` URL |
   | `WS_STATUS_SECRET` | same secret configured on Railway |
   | `EA_SIGNING_SECRET_ENCRYPTION_KEY` | 32-byte base64 key for EA v2 signing secrets |
   | `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` | 32-byte base64 key for exchange credential encryption |

   Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is used by trusted server
   routes and scripts; never expose it with a `NEXT_PUBLIC_` prefix or import
   the admin client from client components.
4. **Deployments → … on the latest deployment → Redeploy** (or push any
   commit; the next one will build with the new settings).

## Verifying the deploy

After deploy completes:

```bash
curl -sS https://YOUR-DOMAIN/login | grep -i "ENTER THE MARKET" | head -1
curl -sS https://YOUR-DOMAIN/p/3485fd85-4a07-46ab-80f1-0395d0137b67 | grep -i "PUBLIC TRADES"
```

Both should return matches. The first proves the auth pages render; the
second proves the public share-page route works for an existing community
profile (jefe).

In the browser:
- `/login` → email/password form
- Log in with an existing user → `/dashboard`
- Click through Journal / Leaderboard / Profile
- For any user whose row exists in `public.admin_users`: the Admin nav
  link appears and `/admin` renders the management panel. (Promote a
  user via the admin RPC; do not hard-code email addresses in docs —
  this file is in a public repo.)

## What changes for users

| | Before (static `index.html`) | After (Next.js at root URL) |
|---|---|---|
| URL | `/index.html` (single SPA) | `/login`, `/dashboard`, `/journal`, `/feed`, `/discover`, `/leaderboard`, `/profile`, `/admin`, `/@username`, `/p/[id]` |
| Auth | localStorage tokens | HTTP-only cookies (more secure, survives tab reload identically) |
| Profile reads | Anon could read all emails | Anon reads return `[]`; emails never in HTML |
| Admin | Frontend email allowlist | Server-side `admin_users` table |
| Charts | Permanent public URLs | Signed URLs, 1h TTL, regenerated each render |
| Avatars | Permanent public URLs | Same private-bucket pattern as charts |

## Compatibility window

The old static files now live under `archive/legacy-static-app/` and are **not
deployed** once Vercel's Root Directory is set to `web/`. Vercel only sees that
subdirectory.

The old root-static rollback path is no longer the normal rollback path. Roll
back by redeploying a known-good Vercel deployment of `web/`.

Legacy static assets have already been moved out of the deploy path.

## Domain

If the project is on a custom domain (e.g. `journal.bigmarkt.co`), nothing
to change — the Root Directory setting affects only the build, not the
domain mapping. `*.vercel.app` preview URLs work the same way.

If the project was on `bigmarkt-trade-journal.vercel.app` (auto-assigned),
that URL keeps working too.
