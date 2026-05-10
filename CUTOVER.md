# Cutover: static `index.html` → Next.js app at `web/`

The Next.js rebuild lives at `web/`. Vercel needs to know to build from
that subdirectory rather than treating the repo root as a static site.

## One-time Vercel setup (do this in the dashboard)

1. Open the BigMarkt project on https://vercel.com/dashboard
2. **Settings → General → Root Directory** → set to `web` → Save
   (Vercel will auto-detect Next.js once this is set.)
3. **Settings → Environment Variables** → add for **Production**, **Preview**, and **Development**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://awvrylniqppybwaiwzse.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon JWT (Supabase dashboard → Settings → API) |

   **Do not** add `SUPABASE_SERVICE_ROLE_KEY` to Vercel. It's never imported
   from `app/` or `components/`; only the test suite needs it.
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
- For `sylvesterejemah@gmail.com` (the one promoted admin): the Admin nav
  link appears and `/admin` renders the management panel.

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

The old static files (`index.html`, `css/`, `js/`) **stay in the repo for
now** but are **not deployed** once Vercel's Root Directory is set to
`web/`. Vercel only sees that subdirectory.

If you need an emergency rollback: change Root Directory back to `/` (or
unset it) and the static app deploys again.

The legacy schema columns (`trades.image_url`, `trades.trade_visibility`,
`profiles.avatar_url`) are still populated on every write so the old app
keeps working if rolled back. They get dropped in a follow-up migration
once cutover is confirmed stable for ~1 week.

## After ~1 week of stable cutover

1. Delete `index.html`, `css/`, `js/`, `manifest.json`, `assets/` from the
   repo root.
2. Apply migration `0011_drop_legacy_columns.sql` (TBD, see plan in plan
   docs) — drops `trade_visibility`, `image_url`, `avatar_url`.
3. Update writes in `web/app/(app)/actions.ts` to stop mirroring into the
   legacy columns.

## Domain

If the project is on a custom domain (e.g. `journal.bigmarkt.co`), nothing
to change — the Root Directory setting affects only the build, not the
domain mapping. `*.vercel.app` preview URLs work the same way.

If the project was on `bigmarkt-trade-journal.vercel.app` (auto-assigned),
that URL keeps working too.
