# fts.bigmarkt.co — Forex Trading School

The trading academy at [fts.bigmarkt.co](https://fts.bigmarkt.co). 13-module curriculum, boot-camp applications, structured forex training.

## Develop

```bash
cd sites/fts
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Required environment for bootcamp applications:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY=YOUR_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET_KEY
```

For local development only, `ALLOW_INSECURE_NO_TURNSTILE=1` bypasses Turnstile
when no secret is configured.

## Deploy

Auto-deploys to Vercel on push to `main`. The Vercel project is wired to `sites/fts` as its root.
