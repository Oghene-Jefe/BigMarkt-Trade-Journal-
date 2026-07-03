# Cutover: static app to Next.js `web/`

Status: historical. The live journal is the Next.js app in `web/`. The legacy
static app has been moved to `archive/legacy-static-app/` and is not the
deployed production surface.

The Next.js rebuild lives at `web/`. Vercel needs to know to build from
that subdirectory rather than treating the repo root as a static site.

## One-time Vercel setup (do this in the dashboard)

1. Open the BigMarkt project on https://vercel.com/dashboard
2. **Settings → General → Root Directory** → set to `web` → Save
   (Vercel will auto-detect Next.js once this is set.)
3. **Settings → Environment Variables** → add for **Production**, **Preview**, and **Development**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` (from Supabase dashboard → Settings → API → Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon JWT (Supabase dashboard → Settings → API → anon public key) |

   Add `SUPABASE_SERVICE_ROLE_KEY` only as a server-side Vercel secret. It is
   required by trusted server routes such as EA ingest and must never be exposed
   to client components or public browser bundles.
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
| URL | `/index.html` (single SPA) | `/login`, `/dashboard`, `/journal`, `/leaderboard`, `/profile`, `/admin`, `/p/[id]` |
| Auth | localStorage tokens | HTTP-only cookies (more secure, survives tab reload identically) |
| Profile reads | Anon could read all emails | Anon reads return `[]`; emails never in HTML |
| Admin | Frontend email allowlist | Server-side `admin_users` table |
| Charts | Permanent public URLs | Signed URLs, 1h TTL, regenerated each render |
| Avatars | Permanent public URLs | Same private-bucket pattern as charts |

## Compatibility window

The old static files now live under `archive/legacy-static-app/`. They are not
deployed when Vercel's Root Directory is `web/`.

An emergency rollback to the archive would require restoring/deploying the
archived static app intentionally; simply unsetting the Vercel root directory is
no longer a complete rollback plan.

The legacy schema columns (`trades.image_url`, `trades.trade_visibility`,
`profiles.avatar_url`) are still present for data compatibility. Current app
writes still mirror `trade_visibility`; removal needs a dedicated migration and
code cleanup, not a routine cutover step.

## Post-cutover status

- Root-level static app files have been removed or archived.
- Production journal writes and reads through the Next.js app.
- Legacy compatibility notes in this file should be treated as historical
  context, not current deployment instructions.

## Domain

If the project is on a custom domain (e.g. `journal.bigmarkt.co`), nothing
to change — the Root Directory setting affects only the build, not the
domain mapping. `*.vercel.app` preview URLs work the same way.

If the project was on `bigmarkt-trade-journal.vercel.app` (auto-assigned),
that URL keeps working too.
