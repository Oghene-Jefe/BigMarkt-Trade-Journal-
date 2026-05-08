/* ====================================================
   TRADE SHARE CARD
   ==================================================== */
let _shareCardDataUrl = null;
let _shareCardTrade   = null;

function openShareModal(tradeId) {
  const trade = state.trades.find(t => String(t.id) === String(tradeId));
  if (!trade) { toast('Trade not found.', 'error'); return; }
  _shareCardTrade   = trade;
  _shareCardDataUrl = null;

  const img = document.getElementById('shareCardImg');
  img.src = '';
  img.style.opacity = '0.3';
  document.getElementById('shareModal').classList.add('show');

  _buildTradeCard(trade).then(dataUrl => {
    _shareCardDataUrl = dataUrl;
    img.src = dataUrl;
    img.style.opacity = '1';
  });

  // Native share (mobile)
  const nativeRow = document.getElementById('shareNativeRow');
  nativeRow.style.display = (typeof navigator.share === 'function') ? 'block' : 'none';

  // Copy button — only if ClipboardItem supported
  document.getElementById('copyCardBtn').style.display =
    (window.ClipboardItem && navigator.clipboard) ? '' : 'none';
}

function closeShareModal() {
  document.getElementById('shareModal').classList.remove('show');
  _shareCardDataUrl = null;
  _shareCardTrade   = null;
}

/* ── Canvas helpers ── */
function _crr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,   x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r,       r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,   x + r, y,             r);
  ctx.closePath();
}

function _pill(ctx, x, y, w, h, bg, border, text, textColor) {
  const r = h / 2;
  ctx.fillStyle = bg;
  _crr(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  _crr(ctx, x, y, w, h, r);
  ctx.stroke();
  ctx.fillStyle = textColor;
  ctx.font = '700 12px "Bebas Neue", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

/* Converts the Big M▲rkt wordmark SVG to an HTMLImageElement so canvas
   gets pixel-perfect Inter 800 rendering with the gold triangle. */
function _loadLogoImage(fontSize) {
  return new Promise((resolve) => {
    const f = fontSize || 48;
    const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="${f + 20}"><text y="${f}" font-family="Inter, Arial, sans-serif" font-weight="800" font-size="${f}px"><tspan fill="#F5F5F5">Big M</tspan><tspan fill="#D4AF37">▲</tspan><tspan fill="#F5F5F5">rkt</tspan></text></svg>`;
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* ── Main card builder ── */
async function _buildTradeCard(trade) {
  const W = 600, H = 348;
  const canvas = document.createElement('canvas');
  const DPR = 2;
  canvas.width  = W * DPR;
  canvas.height = H * DPR;
  const ctx = canvas.getContext('2d');
  ctx.scale(DPR, DPR);

  const GOLD       = '#D4AF37';
  const GOLD_DIM   = 'rgba(212,175,55,0.5)';
  const GOLD_FAINT = 'rgba(212,175,55,0.1)';
  const WIN_C      = '#10B981';
  const LOSS_C     = '#EF4444';
  const TEXT       = '#E4E4E4';
  const MUTED      = 'rgba(228,228,228,0.42)';
  const P          = 30;  // padding

  // ── Background ──
  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, W, H);

  // Radial glow top-left
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
  grd.addColorStop(0, 'rgba(212,175,55,0.07)');
  grd.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Subtle dot grid in content zone
  ctx.fillStyle = 'rgba(212,175,55,0.035)';
  for (let gx = P + 6; gx < W - P; gx += 22) {
    for (let gy = 88; gy < 280; gy += 22) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Outer border ──
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1.5;
  _crr(ctx, 4, 4, W - 8, H - 8, 10);
  ctx.stroke();

  // Inner faint border
  ctx.strokeStyle = GOLD_FAINT;
  ctx.lineWidth = 1;
  _crr(ctx, 9, 9, W - 18, H - 18, 7);
  ctx.stroke();

  // ── BigM▲rkt wordmark (SVG→Image for pixel-perfect gold triangle) ──
  const logoImg = await _loadLogoImage(21);
  if (logoImg) ctx.drawImage(logoImg, 40, 36);

  // Subtitle
  ctx.fillStyle = GOLD_DIM;
  ctx.font = '600 9px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('FTS TRADE JOURNAL', P, 75);

  // Date (top-right)
  ctx.fillStyle = MUTED;
  ctx.font = '400 10.5px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  const dateStr = new Date(trade.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  ctx.fillText(dateStr, W - P, 63);
  ctx.textAlign = 'left';

  // Header divider
  ctx.strokeStyle = 'rgba(212,175,55,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, 83); ctx.lineTo(W - P, 83); ctx.stroke();

  // ── Pair name ──
  ctx.fillStyle = GOLD;
  ctx.font = '700 54px "Bebas Neue", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(trade.pair || '—', W / 2, 128);

  // ── Direction + Result pills ──
  const isLong = trade.direction === 'BUY';
  const isWin  = trade.result === 'WIN';
  const isBE   = trade.result === 'BREAKEVEN';
  const resultLabel = isBE ? 'BE' : (trade.result || '—');

  const PW = 74, PH = 27, PG = 10;
  const pill1X = W / 2 - PW - PG / 2;
  const pill2X = W / 2 + PG / 2;
  const pillY  = 172 - PH / 2;

  _pill(ctx, pill1X, pillY, PW, PH,
    isLong ? 'rgba(16,185,129,0.17)' : 'rgba(239,68,68,0.17)',
    isLong ? WIN_C : LOSS_C,
    trade.direction || 'BUY',
    isLong ? WIN_C : LOSS_C);

  _pill(ctx, pill2X, pillY, PW, PH,
    isWin ? 'rgba(16,185,129,0.17)' : isBE ? 'rgba(212,175,55,0.17)' : 'rgba(239,68,68,0.17)',
    isWin ? WIN_C : isBE ? GOLD : LOSS_C,
    resultLabel,
    isWin ? WIN_C : isBE ? GOLD : LOSS_C);

  // ── PnL ──
  const pnl = Number(trade.pnl) || 0;
  const pnlStr = (pnl > 0 ? '+$' : pnl < 0 ? '-$' : '$') + Math.abs(pnl).toFixed(2);
  ctx.fillStyle = pnl > 0 ? WIN_C : pnl < 0 ? LOSS_C : GOLD;
  ctx.font = '700 42px "Bebas Neue", Impact, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pnlStr, W / 2, 207);

  // ── Stats row (RR / Session / Strategy / Grade) ──
  const stats = [{ label: 'RR', value: trade.rr_ratio ? '1:' + Number(trade.rr_ratio).toFixed(1) : '—' }];
  if (trade.session)     stats.push({ label: 'SESSION',  value: trade.session });
  if (trade.strategy)    stats.push({ label: 'STRATEGY', value: trade.strategy.length > 13 ? trade.strategy.slice(0, 12) + '…' : trade.strategy });
  if (trade.setup_grade) stats.push({ label: 'GRADE',    value: trade.setup_grade });
  if (stats.length < 2)  stats.push({ label: 'DIRECTION', value: trade.direction || '—' });

  const statsY = 246;
  const colW = (W - P * 2) / stats.length;
  stats.forEach((s, i) => {
    const cx = P + colW * i + colW / 2;
    if (i > 0) {
      ctx.strokeStyle = 'rgba(212,175,55,0.16)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(P + colW * i, statsY - 13);
      ctx.lineTo(P + colW * i, statsY + 14);
      ctx.stroke();
    }
    ctx.fillStyle = GOLD_DIM;
    ctx.font = '400 8.5px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, cx, statsY - 5);
    ctx.fillStyle = TEXT;
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.fillText(s.value, cx, statsY + 10);
  });

  // ── Entry / Exit / Lots row ──
  const entryVal = trade.entry_price != null ? String(Number(trade.entry_price)) : '—';
  const exitVal  = trade.exit_price  != null ? String(Number(trade.exit_price))  : '—';
  const lotVal   = trade.lot_size    != null ? Number(trade.lot_size).toFixed(2)  : '—';
  const SEP      = '  ·  ';
  const infoY    = 269;
  ctx.font = '500 10.5px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  const fullInfo  = 'Entry: ' + entryVal + SEP + 'Exit: ' + exitVal + SEP + 'Lots: ' + lotVal;
  let ix = W / 2 - ctx.measureText(fullInfo).width / 2;
  const _seg = (text, color) => {
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(text, ix, infoY);
    ix += ctx.measureText(text).width;
  };
  _seg('Entry: ', GOLD_DIM); _seg(entryVal, TEXT);
  _seg(SEP, MUTED);
  _seg('Exit: ',  GOLD_DIM); _seg(exitVal,  TEXT);
  _seg(SEP, MUTED);
  _seg('Lots: ',  GOLD_DIM); _seg(lotVal,   TEXT);

  // ── Footer divider ──
  ctx.strokeStyle = 'rgba(212,175,55,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(P, 285); ctx.lineTo(W - P, 285); ctx.stroke();

  // Footer URL
  ctx.fillStyle = GOLD_DIM;
  ctx.font = '400 9.5px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Track every trade at journal.bigmarkt.co', P, 316);

  // ── Gold triangle watermark (bottom-right) ──
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(W - P,      H - P);         // right-bottom
  ctx.lineTo(W - P - 52, H - P);         // left-bottom
  ctx.lineTo(W - P,      H - P - 60);    // apex
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  return canvas.toDataURL('image/png');
}

/* ── Share actions ── */
async function shareCardNative() {
  if (!_shareCardDataUrl) return;
  try {
    const blob = await (await fetch(_shareCardDataUrl)).blob();
    const file = new File([blob], 'bigmarkt-trade.png', { type: 'image/png' });
    const text = _buildShareText(_shareCardTrade);
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ title: 'BigMarkt Trade', text, files: [file] });
    } else {
      await navigator.share({ title: 'BigMarkt Trade', text });
    }
  } catch (e) {
    if (e.name !== 'AbortError') toast('Share failed. Try downloading instead.', 'error');
  }
}

function downloadShareCard() {
  if (!_shareCardDataUrl) return;
  const t = _shareCardTrade;
  const slug = ((t.pair || 'trade').replace('/', '-') + '_' + new Date(t.created_at).toISOString().slice(0, 10)).toLowerCase();
  const a = document.createElement('a');
  a.href = _shareCardDataUrl;
  a.download = 'bigmarkt-' + slug + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function copyShareCard() {
  if (!_shareCardDataUrl) return;
  try {
    const blob = await (await fetch(_shareCardDataUrl)).blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    toast('Card copied to clipboard ✅');
  } catch (e) {
    toast('Copy failed — try Save as PNG instead.', 'error');
  }
}

function shareToWhatsApp() {
  const text = encodeURIComponent(_buildShareText(_shareCardTrade));
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  window.open(isMobile ? 'whatsapp://send?text=' + text : 'https://web.whatsapp.com/send?text=' + text, '_blank');
  toast('Save the PNG first, then attach it in WhatsApp.');
}

function shareToTelegram() {
  const url  = encodeURIComponent('https://journal.bigmarkt.co');
  const text = encodeURIComponent(_buildShareText(_shareCardTrade));
  window.open('https://t.me/share/url?url=' + url + '&text=' + text, '_blank');
  toast('Save the PNG first, then attach it in Telegram.');
}

function _buildShareText(trade) {
  if (!trade) return '';
  const pnl = Number(trade.pnl) || 0;
  const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);
  const rr = trade.rr_ratio ? ' | RR 1:' + Number(trade.rr_ratio).toFixed(1) : '';
  const session = trade.session ? ' | ' + trade.session : '';
  return [
    '📈 BigMarkt Trade Journal',
    (trade.pair || '') + ' · ' + (trade.direction || '') + ' · ' + (trade.result || ''),
    'PnL: ' + pnlStr + rr + session,
    'Track your trades → https://journal.bigmarkt.co'
  ].join('\n');
}

/* ====================================================
   REPORT SHARE CARD  (weekly / monthly)
   ==================================================== */
let _reportCardDataUrl = null;
let _reportCardMode    = null;

/* Filter trades to the current ISO week (Mon–Sun) or calendar month */
function _getReportTrades(mode) {
  const now = new Date();
  if (mode === 'weekly') {
    const day  = now.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    const mon  = new Date(now);
    mon.setDate(now.getDate() + diff);
    mon.setHours(0, 0, 0, 0);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    sun.setHours(23, 59, 59, 999);
    return state.trades.filter(t => { const d = new Date(t.created_at); return d >= mon && d <= sun; });
  }
  const y = now.getFullYear(), m = now.getMonth();
  return state.trades.filter(t => { const d = new Date(t.created_at); return d.getFullYear() === y && d.getMonth() === m; });
}

function _getReportPeriodLabel(mode) {
  const now = new Date();
  const MO  = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  if (mode === 'weekly') {
    const day  = now.getDay();
    const diff = (day === 0) ? -6 : 1 - day;
    const mon  = new Date(now);
    mon.setDate(now.getDate() + diff);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return 'WEEK OF ' + MO[mon.getMonth()] + ' ' + mon.getDate() + ' — ' + MO[sun.getMonth()] + ' ' + sun.getDate() + ', ' + sun.getFullYear();
  }
  return MO[now.getMonth()] + ' ' + now.getFullYear() + ' PERFORMANCE';
}

async function generateReportCard(mode) {
  const W = 1080, H = 1080;

  // Load both logo images before drawing (SVG→Image for gold triangle)
  const logoImg      = await _loadLogoImage(52);
  const watermarkImg = await _loadLogoImage(28);

  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  const GOLD   = '#D4AF37';
  const WIN_C  = '#22c55e';
  const LOSS_C = '#ef4444';
  const TEXT   = '#F5F5F5';
  const MUTED  = '#888888';

  // Background
  ctx.fillStyle = '#0A0A0A';
  ctx.fillRect(0, 0, W, H);

  // Gold radial glow — top-left corner
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 500);
  grd.addColorStop(0, 'rgba(212,175,55,0.10)');
  grd.addColorStop(1, 'rgba(212,175,55,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Logo: Big M▲rkt at (80, 76)
  if (logoImg) ctx.drawImage(logoImg, 80, 76);

  // "FTS TRADE JOURNAL" subtitle with manual letter-spacing
  ctx.fillStyle = GOLD;
  ctx.font = '600 20px "Inter", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const subChars = 'FTS TRADE JOURNAL';
  let sx = 80;
  for (let ci = 0; ci < subChars.length; ci++) {
    ctx.fillText(subChars[ci], sx, 148);
    sx += ctx.measureText(subChars[ci]).width + (subChars[ci] === ' ' ? 6 : 3);
  }

  // Gold header divider y=175
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 175); ctx.lineTo(1000, 175); ctx.stroke();
  ctx.globalAlpha = 1;

  // Period label centered y=230
  ctx.fillStyle = MUTED;
  ctx.font = '400 22px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(_getReportPeriodLabel(mode), W / 2, 230);

  // Compute stats
  const trades   = _getReportTrades(mode);
  const wins     = trades.filter(t => t.result === 'WIN').length;
  const losses   = trades.filter(t => t.result === 'LOSS').length;
  const total    = wins + losses;
  const winRate  = total ? Math.round(wins / total * 100) : 0;
  const totalPnL = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const rrList   = trades.map(t => Number(t.rr_ratio)).filter(r => r > 0);
  const avgRR    = rrList.length ? rrList.reduce((a, b) => a + b, 0) / rrList.length : null;

  const pairWins = {};
  trades.filter(t => t.result === 'WIN' && t.pair).forEach(t => { pairWins[t.pair] = (pairWins[t.pair] || 0) + 1; });
  const bestPair = Object.keys(pairWins).sort((a, b) => pairWins[b] - pairWins[a])[0] || null;

  const sessWins = {};
  trades.filter(t => t.result === 'WIN' && t.session).forEach(t => { sessWins[t.session] = (sessWins[t.session] || 0) + 1; });
  const bestSess = Object.keys(sessWins).sort((a, b) => sessWins[b] - sessWins[a])[0] || null;

  if (trades.length === 0) {
    // No trades this period
    ctx.fillStyle = '#555555';
    ctx.font = '400 36px "Inter", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO TRADES THIS PERIOD', W / 2, 540);
  } else {
    // 2×2 stat grid: col centers x=200 and x=680; row tops y=300 and y=520
    const pnlAbs = Math.abs(totalPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pnlStr = (totalPnL >= 0 ? '+$' : '-$') + pnlAbs;
    const cells  = [
      { label: 'WIN RATE',  value: winRate + '%',                          color: GOLD },
      { label: 'TOTAL PnL', value: pnlStr,                                 color: totalPnL > 0 ? WIN_C : totalPnL < 0 ? LOSS_C : GOLD },
      { label: 'TRADES',    value: String(trades.length),                  color: TEXT },
      { label: 'AVG RR',    value: avgRR != null ? '1:' + avgRR.toFixed(1) : '—', color: TEXT },
    ];
    const colX = [200, 680];
    const rowY = [300, 520];

    cells.forEach((cell, i) => {
      const cx = colX[i % 2];
      const ry = rowY[Math.floor(i / 2)];

      ctx.fillStyle = MUTED;
      ctx.font = '400 18px "Inter", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cell.label, cx, ry);

      ctx.fillStyle = cell.color;
      ctx.font = '800 68px "Inter", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cell.value, cx, ry + 80);
    });

    // Pill badges centered at y=680 (center of pill row)
    const pillLabels = [];
    if (bestPair) pillLabels.push('BEST PAIR: ' + bestPair);
    if (bestSess) pillLabels.push('BEST SESSION: ' + bestSess);

    if (pillLabels.length > 0) {
      ctx.font = '600 18px "Inter", Arial, sans-serif';
      const pillH = 40, pillPadX = 20, pillGap = 20, pillY = 680;
      const pillWidths = pillLabels.map(t => ctx.measureText(t).width + pillPadX * 2);
      const totalPillW = pillWidths.reduce((a, b) => a + b, 0) + pillGap * (pillLabels.length - 1);
      let px = W / 2 - totalPillW / 2;

      pillLabels.forEach((txt, i) => {
        const pw = pillWidths[i], pr = pillH / 2;
        const py = pillY - pillH / 2;

        // Pill stroke (no fill — transparent background)
        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = GOLD;
        ctx.lineWidth = 1.5;
        _crr(ctx, px, py, pw, pillH, pr);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Pill text
        ctx.fillStyle = GOLD;
        ctx.font = '600 18px "Inter", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(txt, px + pw / 2, pillY);
        px += pw + pillGap;
      });
    }
  }

  // Gold footer divider y=780
  ctx.globalAlpha = 0.4;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(80, 780); ctx.lineTo(1000, 780); ctx.stroke();
  ctx.globalAlpha = 1;

  // Trader name — left, y=820
  const traderName = (state.profile && state.profile.name) ||
    (state.user && state.user.email && state.user.email.split('@')[0]) || 'Trader';
  ctx.fillStyle = TEXT;
  ctx.font = '700 22px "Inter", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(traderName, 80, 820);

  // Community tag — right, y=820
  ctx.fillStyle = '#555555';
  ctx.font = '400 18px "Inter", Arial, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('FTS COMMUNITY · BIGMARKT', 1000, 820);

  // Watermark logo — centered, faint, y=920
  ctx.globalAlpha = 0.15;
  if (watermarkImg) ctx.drawImage(watermarkImg, (W - 320) / 2, 920);
  ctx.globalAlpha = 1;

  // URL — centered, y=990
  ctx.fillStyle = '#444444';
  ctx.font = '400 18px "Inter", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('journal.bigmarkt.co', W / 2, 990);

  return canvas.toDataURL('image/png');
}

function showReportCardModal(mode) {
  _reportCardMode    = mode;
  _reportCardDataUrl = null;

  const modal = document.getElementById('reportCardModal');
  const img   = document.getElementById('reportCardPreview');
  img.src = ''; img.style.opacity = '0.3';
  modal.classList.add('show');

  generateReportCard(mode).then(dataUrl => {
    _reportCardDataUrl = dataUrl;
    img.src = dataUrl;
    img.style.opacity = '1';
  });
}

function closeReportCardModal() {
  document.getElementById('reportCardModal').classList.remove('show');
  _reportCardDataUrl = null;
  _reportCardMode    = null;
}

function downloadReportCard() {
  if (!_reportCardDataUrl) return;
  const a = document.createElement('a');
  a.href = _reportCardDataUrl;
  a.download = _reportCardMode === 'weekly' ? 'bigmarkt-weekly-report.png' : 'bigmarkt-monthly-report.png';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function shareReportToWhatsApp() {
  const period    = _getReportPeriodLabel(_reportCardMode);
  const typeLabel = _reportCardMode === 'weekly' ? 'Weekly' : 'Monthly';
  const msg = '📊 My ' + typeLabel + ' Trading Report — ' + period + '\n' +
              'Check out my stats on BigMarkt FTS Trade Journal 🔥\n' +
              'Track yours free: journal.bigmarkt.co';
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  window.open((isMobile ? 'whatsapp://send?text=' : 'https://wa.me/?text=') + encodeURIComponent(msg), '_blank');
  toast('Save the image first, then attach it in WhatsApp.');
}
