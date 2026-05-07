/* ---------- toast ---------- */
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.toggle('error', type === 'error');
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- spinner ---------- */
function showSpinner(label = 'LOADING…') {
  const overlay = document.getElementById('spinnerOverlay');
  document.getElementById('spinnerLabel').textContent = label;
  overlay.classList.add('show');
}
function hideSpinner() {
  document.getElementById('spinnerOverlay').classList.remove('show');
}

/* ---------- helpers ---------- */
function fmtMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(n);
  if (v >= 1000) return sign + '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return sign + '$' + v.toFixed(2);
}
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// Full date + time for journal table — shows "May 3, 2026 · 14:35"
function fmtDateTime(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return date + '<br><span style="color:var(--muted-2);font-size:11px;">' + time + '</span>';
}
function pillResult(r) {
  const cls = r === 'WIN' ? 'pill-win' : r === 'LOSS' ? 'pill-loss' : 'pill-be';
  return `<span class="pill ${cls}">${r === 'BREAKEVEN' ? 'BE' : r}</span>`;
}
function pillDir(d) {
  return `<span class="pill ${d === 'BUY' ? 'pill-buy' : 'pill-sell'}">${d}</span>`;
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toggleTheme() {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  document.getElementById('themeBtn').textContent = isLight ? '🌞' : '🌙';
  localStorage.setItem('bm_theme', isLight ? 'light' : 'dark');
}
function loadTheme() {
  const saved = localStorage.getItem('bm_theme');
  if (saved === 'light') {
    document.body.classList.add('light-mode');
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = '🌞';
  }
}

/* ====================================================
   PASSWORD EYE TOGGLE
   ==================================================== */
function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

function downloadFile(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
