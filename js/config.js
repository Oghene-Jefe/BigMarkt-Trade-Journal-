// ── SUPABASE INIT ──────────────────────────────────────────────
const SUPABASE_URL = 'https://awvrylniqppybwaiwzse.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dnJ5bG5pcXBweWJ3YWl3enNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2NjU2MTMsImV4cCI6MjA5MzI0MTYxM30.i_gbMGZGuJRsHumk-DqpVNVDIjaJ25x4sS8zqQdkPLY';

// Guard: if CDN didn't load (network error, ad blocker, etc.) show friendly error
if (typeof supabase === 'undefined') {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0A0A0A;color:#D4AF37;font-family:sans-serif;text-align:center;padding:24px;"><div><div style="font-size:48px;margin-bottom:16px;">⚠️</div><div style="font-family:\'Bebas Neue\',sans-serif;font-size:28px;margin-bottom:10px;">LOADING FAILED</div><div style="color:#888;font-size:14px;margin-bottom:20px;">Check your internet connection or disable any ad blockers, then refresh.</div><button onclick="location.reload()" style="background:#D4AF37;color:#000;border:none;padding:12px 28px;border-radius:8px;font-size:16px;font-family:\'Bebas Neue\',sans-serif;letter-spacing:0.1em;cursor:pointer;">REFRESH</button></div></div>';
  throw new Error('Supabase CDN failed to load');
}

const _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
