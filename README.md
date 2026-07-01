# BigMarkt Trade Journal

BigMarkt is a verified trade-journaling and social-trading platform. The live
journal app is a Next.js + Supabase rebuild in `web/`; the old static app is
archived under `archive/legacy-static-app/`.

## Live Surfaces

- `journal.bigmarkt.co` — authenticated journal, public profiles, feed, EA ingest
- `bigmarkt.co` — protocol marketing site and blog (`sites/marketing`)
- `fts.bigmarkt.co` — Forex Trading School site (`sites/fts`)
- `club.bigmarkt.co` — campus club site (`sites/club`)
- Railway WebSocket service — MT5 EA presence/status only (`websocket-server`)

## Repository Layout

| Path | Purpose |
|---|---|
| `web/` | Main journal app: auth, onboarding, journal, feed, leaderboard, EA setup, broker/exchange tooling, admin surfaces |
| `supabase/migrations/` | Versioned database migrations. Production migrations are applied manually in the Supabase SQL Editor. |
| `websocket-server/` | Railway Node service for EA WebSocket presence and protected `/status` polling |
| `sites/marketing/` | Public marketing and blog site |
| `sites/fts/` | FTS academy application site |
| `sites/club/` | Club application site |
| `mql5/` and `web/public/downloads/` | MT5 EA source and downloadable builds |
| `infra/` | Supporting infrastructure snippets, including the optional Bybit proxy worker |

## Contributor Workflow

BigMarkt uses a multi-agent development loop:

1. Codex and Gemini Pro brainstorm and shape requirements.
2. Codex designs the architecture.
3. Claude implements the build.
4. Codex performs QA and produces findings/recommendations.
5. Claude applies the Codex QA results.
6. Codex re-audits and passes the work when the coast is clear.
