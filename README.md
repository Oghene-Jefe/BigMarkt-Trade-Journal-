# BigMarkt

BigMarkt is a broker-verified trading journal and social proof platform. The production journal is at [journal.bigmarkt.co](https://journal.bigmarkt.co), with separate marketing, academy, and club sites.

## Repository layout

| Path | Purpose |
|---|---|
| `web/` | Production Next.js journal |
| `supabase/migrations/` | Versioned production schema changes |
| `mql5/` | MT5 Expert Advisor source |
| `websocket-server/` | EA presence/status service for Railway |
| `sites/marketing/` | `bigmarkt.co` |
| `sites/fts/` | `fts.bigmarkt.co` academy |
| `sites/club/` | `club.bigmarkt.co` |
| `archive/legacy-static-app/` | Retired static journal, kept for reference only |

## Local development

The services install and run independently. To start the journal:

```bash
cd web
cp .env.example .env.local
npm ci
npm run dev
```

See [`web/README.md`](web/README.md) for required configuration and verification commands. The three public sites have their own READMEs. Railway deployment for the presence service is documented in [`websocket-server/RAILWAY_DEPLOY.md`](websocket-server/RAILWAY_DEPLOY.md).

## Production rules

- Vercel projects deploy from their service directories on pushes to `main`.
- Production database migrations are reviewed SQL files in `supabase/migrations/`, applied manually in the Supabase SQL Editor, and verified against the live schema. Do not run `supabase db push` against production.
- Never commit credentials or local environment files.
- Run the relevant package's typecheck, tests, and build before pushing.

Current implementation and operational state are tracked in [`CURRENT_STATE.md`](CURRENT_STATE.md). Product direction is tracked in [`ROADMAP.md`](ROADMAP.md).

## Contributor workflow

BigMarkt uses an agent-assisted design, implementation, and QA loop. Regardless of the tool used, changes should be focused, reviewed against the production behavior, and verified by the repository checks before merge.
