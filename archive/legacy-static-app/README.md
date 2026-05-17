# Legacy static app — archived

This is the pre-Next.js BigMarkt trade journal: a vanilla HTML/JS/CSS app
talking directly to Supabase from the browser via the anon key. It was
superseded by `web/` (Next.js App Router) and is preserved here only for
reference / git history.

**Do not deploy.** Nothing in this directory should ever be served.

If you no longer need to consult it, delete the entire `archive/` tree.

Notes:
- `js/config.js` originally contained the production Supabase URL + anon
  key. Those values have been **scrubbed to placeholders** in this
  archive — see commit history for the originals if you need them. The
  anon key was safe-by-design (RLS gates everything), but removing it
  from the active tree is just good hygiene.
- If you suspect the original anon key was copied elsewhere before this
  scrub, rotate it in Supabase → Settings → API and update the
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` env var on the journal's Vercel
  project + each `sites/*` project + local `.env.local` files.
