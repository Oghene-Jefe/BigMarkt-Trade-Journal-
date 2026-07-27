# Production setup: Next.js journal app at `web/`

The production journal app lives at `web/`. Vercel must build from that
subdirectory rather than treating the repo root as a static site.

## One-time Vercel setup (do this in the dashboard)

1. Open the BigMarkt project on https://vercel.com/dashboard
2. **Settings → General → Root Directory** → set to `web` → Save
   (Vercel will auto-detect Next.js once this is set.)
3. **Settings → Environment Variables** → add for **Production**, **Preview**, and **Development**:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<your-project-ref>.supabase.co` (from Supabase dashboard → Settings → API → Project URL) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon JWT (Supabase dashboard → Settings → API → anon public key) |
   | `NEXT_PUBLIC_SITE_URL` | canonical public journal URL, for example `https://journal.bigmarkt.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service-role JWT, server-side only |
   | `CRON_SECRET` | long random string for cron route authorization |
   | `EA_SIGNING_SECRET_ENCRYPTION_KEY` | base64 32-byte key; generate with `openssl rand -base64 32` |
   | `EXCHANGE_CREDENTIAL_ENCRYPTION_KEY` | base64 32-byte key; generate with `openssl rand -base64 32` |
   | `WS_STATUS_URL` | deployed Railway `/status` URL |
   | `WS_STATUS_SECRET` | long random string, same value as Railway |
   | `EA_INGEST_V1_CUTOFF_AT` | optional ISO cutoff after which legacy v1 EA ingest is rejected |

   Optional Bybit egress proxy variables, only when direct Bybit calls are
   blocked by the deployment host:

   | Name | Value |
   |---|---|
   | `BYBIT_MAINNET_BASE_URL` | proxy mainnet base URL |
   | `BYBIT_TESTNET_BASE_URL` | proxy testnet base URL |
   | `BYBIT_PROXY_TOKEN` | shared secret between Vercel and the proxy |

   `SUPABASE_SERVICE_ROLE_KEY`, encryption keys, cron secrets, WebSocket
   secrets, and proxy tokens are server-side secrets. Do not expose them through
   `NEXT_PUBLIC_*` names and do not commit local env files.
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
- Click through Journal / Accounts / EA setup / Leaderboard / Following / Feed / Profile
- Generate an EA token in `/ea-setup`, confirm the v2.7.1 EA download link is
  present, and confirm the WebSocket status card degrades safely if Railway is
  offline.
- Follow a trader from `/leaderboard`, confirm they appear in `/following`, and
  confirm `/feed` only shows verified EA trades from followed traders.
- Visit `/upgrade` and confirm free users can join/leave the Pro waitlist while
  comp/active Pro profiles see the entitled state.
- For any user whose row exists in `public.admin_users`: the Admin nav
  link appears and `/admin` renders the management panel. (Promote a
  user via the admin RPC; do not hard-code email addresses in docs —
  this file is in a public repo.)

## What changes for users

| | Before (static `index.html`) | After (Next.js at root URL) |
|---|---|---|
| URL | `/index.html` (single SPA) | `/login`, `/dashboard`, `/journal`, `/accounts`, `/ea-setup`, `/leaderboard`, `/following`, `/feed`, `/profile`, `/upgrade`, `/admin`, `/p/[id]`, `/@[username]` |
| Auth | localStorage tokens | HTTP-only cookies (more secure, survives tab reload identically) |
| Profile reads | Anon could read all emails | Anon reads return `[]`; emails never in HTML |
| Admin | Frontend email allowlist | Server-side `admin_users` table |
| Charts | Permanent public URLs | Signed URLs, 1h TTL, regenerated each render |
| Avatars | Permanent public URLs | Same private-bucket pattern as charts |
| EA trade ingest | Browser/static app writes | Server-only `POST /api/ea/ingest`, bearer-token auth, v2 HMAC signatures, replay protection |
| EA presence | None | Railway WebSocket service polled through scoped `/status` |
| Following | Static/prototype copy-trade UI | Journal-only follow/unfollow, following list, and verified-trade feed |

## Compatibility window

The old static files are archived at `archive/legacy-static-app/` and are **not
deployed** once Vercel's Root Directory is set to `web/`. Vercel only sees that
subdirectory.

If you need an emergency rollback to the archived static app, create a specific
rollback deployment plan first; simply changing Root Directory back to `/` no
longer restores the old root-level static files.

The legacy schema columns (`trades.image_url`, `trades.trade_visibility`,
`profiles.avatar_url`) are still populated on every write so the old app
keeps working if rolled back. They get dropped in a follow-up migration
once cutover is confirmed stable for ~1 week.

## Legacy cleanup

The static app has already been moved to `archive/legacy-static-app/`.
Remaining legacy compatibility is database-level: some writes still mirror
older column names such as `trades.image_url`, `trades.trade_visibility`, and
`profiles.avatar_url`. Drop those only in a planned migration after confirming
there is no rollback or reporting dependency on them.

## Domain

If the project is on a custom domain (e.g. `journal.bigmarkt.co`), nothing
to change — the Root Directory setting affects only the build, not the
domain mapping. `*.vercel.app` preview URLs work the same way.

If the project was on `bigmarkt-trade-journal.vercel.app` (auto-assigned),
that URL keeps working too.
