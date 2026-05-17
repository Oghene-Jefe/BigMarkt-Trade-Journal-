// ── SUPABASE INIT ──────────────────────────────────────────────
// The original BigMarkt project URL and anon key that lived here have
// been scrubbed. This archive is reference-only — do NOT deploy. If you
// ever need to run this old code against a sandbox database, supply
// your own URL/key below. Consider rotating the production anon key in
// Supabase → Settings → API if there's any chance the original was
// copied elsewhere before this scrub.
const SUPABASE_URL = 'https://YOUR-PROJECT-REF.supabase.co';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Guard: if CDN didn't load (network error, ad blocker, etc.) show friendly error
if (typeof supabase === 'undefined') {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0A0A0A;color:#D4AF37;font-family:sans-serif;text-align:center;padding:24px;"><div><div style="font-size:48px;margin-bottom:16px;">⚠️</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;margin-bottom:10px;">LOADING FAILED</div><div style="color:#888;font-size:14px;margin-bottom:20px;">Check your internet connection or disable any ad blockers, then refresh.</div><button onclick="location.reload()" style="background:#D4AF37;color:#000;border:none;padding:12px 28px;border-radius:8px;font-size:16px;font-family:\'Bebas Neue\',sans-serif;letter-spacing:0.1em;cursor:pointer;">REFRESH</button></div></div>';
  throw new Error('Supabase CDN failed to load');
}

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
