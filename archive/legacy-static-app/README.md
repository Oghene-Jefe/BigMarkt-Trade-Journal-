# Legacy static app — archived

This is the pre-Next.js BigMarkt trade journal: a vanilla HTML/JS/CSS app
talking directly to Supabase from the browser via the anon key. It was
superseded by `web/` (Next.js App Router) and is preserved here only for
reference / git history.

**Do not deploy.** Nothing in this directory should ever be served.

If you no longer need to consult it, delete the entire `archive/` tree.

Notes:
- `js/config.js` contains the original Supabase URL + anon key. The anon
  key is safe-by-design (RLS gates everything) but if you ever want full
  isolation from this legacy code, rotate the anon key in Supabase
  Settings → API. The journal/`web` app reads its key from env at build
  time, so a rotation would only require updating Vercel/`web/.env.local`.
