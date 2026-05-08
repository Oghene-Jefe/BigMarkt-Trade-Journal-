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

  document.fonts.ready.then(() => {
    _shareCardDataUrl = _buildTradeCard(trade);
    img.src = _shareCardDataUrl;
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

/* ── Main card builder ── */
function _buildTradeCard(trade) {
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

  // ── BigM▲rkt wordmark ──
  const logoY = 62;
  ctx.font = '800 21px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = TEXT;
  ctx.fillText('BigM', P, logoY);
  const bigMW = ctx.measureText('BigM').width;

  ctx.fillStyle = GOLD;
  ctx.fillText('▲', P + bigMW, logoY);
  const triW = ctx.measureText('▲').width;

  ctx.fillStyle = TEXT;
  ctx.fillText('rkt', P + bigMW + triW, logoY);

  // Subtitle
  ctx.fillStyle = GOLD_DIM;
  ctx.font = '600 9px "Inter", system-ui, sans-serif';
  ctx.fillText('FTS TRADE JOURNAL', P, logoY + 13);

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
