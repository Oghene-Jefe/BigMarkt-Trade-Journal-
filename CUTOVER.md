# Journal deployment topology

The static-to-Next.js cutover is complete. The production journal deploys from `web/`; the retired static application lives in `archive/legacy-static-app/` and is reference material only.

## Vercel project

- Root Directory: `web`
- Framework: Next.js
- Production branch: `main`
- Domain: `journal.bigmarkt.co`
- Scheduled routes: `web/vercel.json`

Environment variables must be configured for the environments that exercise their features. Start from `web/.env.example`; at minimum, normal application rendering requires the public Supabase URL and anon key. Server-side ingestion and administrative operations use the service-role key, while EA signing, exchange credentials, cron routes, WebSocket status, and MetaApi cloud capture have separate secrets.

Do not expose server-only variables through `NEXT_PUBLIC_*` names or client components.

## Deployment verification

After a deployment:

```bash
curl -fsS https://journal.bigmarkt.co/login >/dev/null
curl -fsS https://journal.bigmarkt.co/guide >/dev/null
curl -fsS https://journal.bigmarkt.co/api/public/platform-stats >/dev/null
```

Then smoke-test login, dashboard, journal, accounts, leaderboard, profile, and the public guide. Admin routes should only be visible and accessible to users recorded in `public.admin_users`.

The Railway WebSocket presence/status service deploys independently from `websocket-server/`. Its configuration and health checks are in `websocket-server/RAILWAY_DEPLOY.md`.

## Rollback

Rollback should use a known-good Vercel deployment of the `web/` app. Do not repoint production to the archived static application: its authentication, schema assumptions, and privacy model are obsolete.
