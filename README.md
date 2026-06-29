# BigMarkt Trade Journal

Verified trade-journaling and social-trading platform for SMC/ICT retail
traders. The production app is `journal.bigmarkt.co`; companion public
surfaces live at `bigmarkt.co`, `fts.bigmarkt.co`, and `club.bigmarkt.co`.

## Repository Layout

| Path | Purpose |
|---|---|
| `web/` | Main Next.js journal app: auth, dashboard, journal, leaderboard, Discover, Following, Feed, EA setup, admin, Supabase actions |
| `supabase/migrations/` | Versioned production schema and RPC migrations |
| `mql5/` | MT5 EA source; compiled downloads are served from `web/public/downloads/` |
| `websocket-server/` | Railway service for EA connection presence and protected `/status` polling |
| `sites/marketing/` | `bigmarkt.co` marketing and blog site |
| `sites/fts/` | `fts.bigmarkt.co` academy site |
| `sites/club/` | `club.bigmarkt.co` campus club site |
| `archive/legacy-static-app/` | Pre-cutover static app kept for reference only |

## Main App Commands

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

`npm run build` is mandatory before pushing app changes because it catches
Next.js route and hydration issues that plain typechecking can miss.

## Production Data Rules

- Schema changes must be committed under `supabase/migrations/`.
- Production migrations are applied manually in the Supabase SQL Editor for
  this project; do not run `supabase db push` against production.
- Public feed/profile RPCs must not expose raw dollar P&L. They return
  privacy-safe `return_pct`/`rr_ratio` and selected public trade detail.
- Secrets belong in Vercel, Railway, or local `.env.local` files only. Never
  commit credentials, service-role keys, audit visa docs, or seed data.

## Contributor Workflow

BigMarkt uses a multi-agent development loop:

1. Codex and Gemini Pro brainstorm and shape requirements.
2. Codex designs the architecture.
3. Claude implements the build.
4. Codex performs QA and produces findings/recommendations.
5. Claude applies the Codex QA results.
6. Codex re-audits and passes the work when the coast is clear.
