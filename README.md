# BigMarkt Trade Journal

Verified trade-journaling and social-trading platform for SMC/ICT retail
traders. Production runs from this monorepo:

| Surface | Directory | Production host |
|---|---|---|
| Journal app | `web/` | `journal.bigmarkt.co` |
| Marketing + blog | `sites/marketing/` | `bigmarkt.co` |
| FTS academy | `sites/fts/` | `fts.bigmarkt.co` |
| Club | `sites/club/` | `club.bigmarkt.co` |
| EA WebSocket status bridge | `websocket-server/` | Railway |
| Supabase schema | `supabase/migrations/` | project `awvrylniqppybwaiwzse` |

The journal is a Next.js 15 / React 19 app backed by Supabase Postgres with
RLS. Broker data is captured through a read-only MQL5 EA over HMAC-signed
ingest. MetaApi read-only sync scaffolding exists in code and schema, but the
cron, provisioning UI, and live probe are still pending a funded MetaApi account.
Copy-trading and the `$BMT` token are deliberately out of the current build
scope.

## Local Development

Each app owns its own package lock. Install and run from the app directory you
are working on.

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

Common journal commands:

```bash
cd web
npm run typecheck
npm test
npm run build
```

Supporting sites use the same pattern:

```bash
cd sites/marketing # or sites/fts, sites/club
npm ci
npm run dev
npm run build
```

The EA WebSocket bridge is a separate Node service:

```bash
cd websocket-server
cp .env.example .env
npm ci
npm run dev
```

## Documentation Map

- `CURRENT_STATE.md` is the session handoff and operational source of truth.
- `web/README.md` documents the journal app structure, commands, and env vars.
- `docs/database-migrations.md` documents the current Supabase migration workflow.
- `docs/live-readiness-checklist.md` lists production smoke checks.
- `web/docs/EXCHANGE_SECURITY.md` covers read-only Bybit credential storage.
- `websocket-server/RAILWAY_DEPLOY.md` covers Railway deployment for EA status.

## Contributor Workflow

BigMarkt uses a multi-agent development loop:

1. Codex and Gemini Pro brainstorm and shape requirements.
2. Codex designs the architecture.
3. Claude implements the build.
4. Codex performs QA and produces findings/recommendations.
5. Claude applies the Codex QA results.
6. Codex re-audits and passes the work when the build is clear.

Before pushing journal changes, run `npm run build` from `web/`. Schema changes
must be represented by committed migration files and manually applied through the
Supabase SQL Editor, then verified against production.
