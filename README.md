# BigMarkt Trade Journal

BigMarkt is a multi-site trading platform:

- `web/` — production Trade Journal app at `journal.bigmarkt.co`.
- `websocket-server/` — Railway WebSocket presence/status service for MT5 EA
  connections.
- `sites/marketing/` — public protocol/brand site at `bigmarkt.co`.
- `sites/club/` — campus club site at `club.bigmarkt.co`.
- `sites/fts/` — Forex Trading School site at `fts.bigmarkt.co`.
- `supabase/migrations/` — versioned production database migrations.
- `web/public/downloads/BigMarkt_EA_v2.7.1.mq5` — EA file served by the Trade
  Journal setup wizard.
- `archive/legacy-static-app/` — archived pre-Next.js static app.

Start with `web/README.md` for the journal app, `CUTOVER.md` for Vercel
production setup, `docs/live-readiness-checklist.md` for launch checks, and
`docs/ea-ingest-and-ws-status.md` for the EA ingest/status contracts.

## Contributor Workflow

BigMarkt uses a multi-agent development loop:

1. Codex and Gemini Pro brainstorm and shape requirements.
2. Codex designs the architecture.
3. Claude implements the build.
4. Codex performs QA and produces findings/recommendations.
5. Claude applies the Codex QA results.
6. Codex re-audits and passes the work when the coast is clear.
