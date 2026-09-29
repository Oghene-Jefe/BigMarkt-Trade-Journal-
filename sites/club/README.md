# club.bigmarkt.co — Campus Club

The community site for university trading chapters at [club.bigmarkt.co](https://club.bigmarkt.co). Cohorts, chapter applications, peer-review programmes.

## Develop

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Required environment for form submissions:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...
```

For local-only development without Turnstile, set
`ALLOW_INSECURE_NO_TURNSTILE=1`. Do not set that in production.

## Deploy

Auto-deploys to Vercel on push to `main`. The Vercel project is wired to `sites/club` as its root.
