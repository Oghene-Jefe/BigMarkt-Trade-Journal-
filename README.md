# BigMarkt Trade Journal

Verified trade-journaling and social-trading platform for retail traders.

## Production surfaces

- `web/` - journal app for `journal.bigmarkt.co`
- `sites/marketing/` - public marketing/blog site for `bigmarkt.co`
- `sites/fts/` - academy site for `fts.bigmarkt.co`
- `sites/club/` - community/club site for `club.bigmarkt.co`
- `websocket-server/` - EA presence/status service
- `supabase/migrations/` - tracked database schema and RPC migrations
- `archive/legacy-static-app/` - archived static app, not the live journal

## Common commands

```bash
cd web
npm install
npm run typecheck
npm test
npm run build
```

For the EA status service:

```bash
cd websocket-server
npm install
npm run build
npm test
```

## Contributor Workflow

BigMarkt uses a multi-agent development loop:

1. Codex and Gemini Pro brainstorm and shape requirements.
2. Codex designs the architecture.
3. Claude implements the build.
4. Codex performs QA and produces findings/recommendations.
5. Claude applies the Codex QA results.
6. Codex re-audits and passes the work when the coast is clear.
