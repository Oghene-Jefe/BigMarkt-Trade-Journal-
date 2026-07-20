# BigMarkt

BigMarkt is a verified trade-journaling and social-trading platform. The
production ecosystem consists of:

- [journal.bigmarkt.co](https://journal.bigmarkt.co) — journal, analytics,
  leaderboard, social feed, and broker capture
- [bigmarkt.co](https://bigmarkt.co) — public marketing site and blog
- [fts.bigmarkt.co](https://fts.bigmarkt.co) — Forex Trading School
- [club.bigmarkt.co](https://club.bigmarkt.co) — university trading club

## Repository layout

| Path | Purpose |
|---|---|
| `web/` | Main Next.js journal application |
| `sites/marketing/` | Marketing and blog site |
| `sites/fts/` | FTS academy site |
| `sites/club/` | Campus club site |
| `websocket-server/` | Railway-hosted EA presence/status service |
| `supabase/migrations/` | Ordered production database migrations |
| `mql5/` | Source for the read-only MT5 Expert Advisor |
| `infra/` | Optional Bybit egress proxy |
| `archive/legacy-static-app/` | Retired static application, kept for reference |

Each runnable project owns its dependencies and commands. Start with its local
README; the main application is documented in [`web/README.md`](web/README.md).

## Production architecture

The journal runs on Next.js 15 and React 19 with Supabase Postgres/Auth/Storage
and strict row-level security. Trade capture supports manual entry, an
HMAC-signed read-only MT5 EA, read-only Bybit credentials, and MetaApi cloud
sync. The WebSocket service reports EA presence only; all EA trade ingest uses
the authenticated HTTP endpoint in the journal application.

All four Next.js projects deploy from their own repository subdirectory on
Vercel. The WebSocket service deploys from `websocket-server/` on Railway.

## Database changes

Create a numbered SQL file in `supabase/migrations/` for every schema change.
Production migrations are currently reviewed and applied manually in the
Supabase SQL Editor; do not run `supabase db push` against production. See
[`docs/database-migrations.md`](docs/database-migrations.md) for the current
workflow and known drift limitations.

## Project status

[`CURRENT_STATE.md`](CURRENT_STATE.md) records shipped behavior, production
migration state, and deferred work. Historical proposals in `docs/claude-*`
are design records and may describe superseded implementation plans; use the
code, migrations, user guide, and current-state record as the operational
source of truth.
