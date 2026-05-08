const BM_LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAfQAAAEHCAYAAABY0LQ9AAAgAElEQVR4Xu2dCZhdRZn+z93X3tOdlRDWIODCIoOMQNgTFkUwOuOODm78dUZBGRcgqCioMDg66riMqOMGCiKLICEJQWVEIqCCCElICAlJutPb3ff/+1bfajqdXm6nu0Ny7nufp5/e7j2n6ld16q3vq6++8jh6iYAIiIAIiIAI7PMEPPt8DVQBERABERABERABR4KuTiACIiACIiACLiAgQXdBI6oKIiACIiACIiBBVx8QAREQAREQARcQkKC7oBFVBREQAREQARGQoKsPiIAIiIAIiIALCEjQXdCIqoIIiIAIiIAISNDVB0RABERABETABQQk6C5oRFVBBERABERABCTo6gMiIAIiIAIi4AICEnQXNKKqIAIiIAIiIAISdPUBERABERABEXABAQm6CxpRVRABERABERABCbr6gAiIgAiIgAi4gIAE3QWNqCqIgAiIgAiIgARdfUAEREAEREAEXEBAgu6CRlQVREAEREAERECCrj4gAiIgAiIgAi4gIEF3QSOqCiIgAiIgAiIgQVcfEAEREAEREAEXEJCgu6ARVQUREAEREAERkKCrD4iACIiACIiACwhI0F3QiKqCCIiACIiACEjQ1QdEQAREQAREwAUEJOguaERVQQREQAREQAQk6OoDIiACIiACIuACAhJ0FzSiqiACIiACIiACEnT1AREQAREQARFwAQEJugsaUVUQAREQAREQAQm6+oAIiIAIiIAIuICABN0FjagqiIAIiIAIiIAEXX1ABERABERABFxAQILugkZUFURABERABERAgq4+IAIiIAIiIAIuICBBd0EjqgoiIAIiIAIiIEFXHxABERABERABFxCQoLugEVUFERABERABEZCgqw+IgAiIgAiIgAsISNBd0IiqggiIgAiIgAhI0NUHREAEREAERMAFBCToLmhEVUEEREAEREAEJOjqAyIgAiIgAiLgAgISdBc0oqogAiIgAiIgAhJ09QEREAEREAERcAEBCboLGlFVEAEREAEREAEJuvqACIiACIiACLiAgATdBY2oKoiACIiACIiABF19QAREQAREQARcQECC7oJGVBVEQAREQAREQIKuPiACIiACIiACLiAgQXdBI6oKIiACIiACIiBBVx8QAREQAREQARcQkKC7oBFVBREQAREQARGQoKsPiIAIiIAIiIALCEjQXdCIqoIIiIAIiIAISNDVB0RABERABETABQQk6C5oRFVBBERABERABCTo6gMiIAIiIAIi4AICEnQXNKKqIAIiIAIiIAISdPUBERABERABEXABAQm6CxpRVRABERABERABCbr6gAiIgAiIgAi4gIAE3QWNqCqIgAiIgAiIgARdfUAEREAEREAEXEBAgu6CRlQVREAEREAERECCrj4gAiIgAiIgAi4gIEF3QSOqCiIgAiIgAiIgQVcfEAEREAEREAEXEJCgu6ARVQUREAEREAERkKCrD4iACIiACIiACwhI0F3QiKqCCIiACIiACEjQ1QdEQAREQAREwAUEJOguaERVQQREQAREQAQk6OoDIiACIiACIuACAhJ0FzSiqiACIiACIiACEnT1AREQAREQARFwAQEJugsaUVUQAREQAREQAQm6+oAIiIAIiIAIuICABN0FjagqiIAIiIAIiIAEXX1ABERABERABFxAQILugkZUFURABERABERAgq4+IAIiIAIiIAIuICBBd0EjqgoiIAIiIAIiIEFXHxABERABERABFxCQoLugEVUFERABERABEZCgqw+IgAiIgAiIgAsISNBd0IiqggiIgAiIgAhI0NUHREAEREAERMAFBCToLmhEVUEEREAEREAEJOjqAyIgAiIgAiLgAgISdBc0oqogAiIgAiIgAhJ09QEREAEREAERcAEBCboLGlFVEAEREAEREAEJuvqACIiACIiACLiAgATdBY2oKoiACIiACIiABF19QAREwNUEli5d6rvllltKrq6kKicCICBBVzcQARFwJYFjjjkmcN5551WWLVtWdGUFVSkRGEZAgq4uIQIi4HoCCxcubPj73/+eR0Vzrq+sKli3BCToddv0wyq+yAk7i5yiswxfbn0tc/yurp9b22036xWMB18W8UWWBQKBA8vlcrFSqezI5/MrWlpavvH8889ndvOy+pgI7LUEJOh7bdPs2YI1z537yv6urtdGA4GDHZ8zt1Qod5YqxQc62jrucMvg197eHu/s7EzuWbK13e3ggw8OrV27VtZjbbjGfVckEpnrD/h/NqNtxuHPPvtsi8/nc6LRqJNOp9fhf19asmTJ97CuTotdLxFwDQEJ+h5oymPOO2bGHGfOzFmz2o94/vkXwi+88Hwxm03P7utLr09lsxHH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g4AEvT7aWbUUAREQARFwOQEJussbWNUTAREQARGoDwIS9PpoZ9VSBERABETA5QQk6C5vYFVPBERABESgPghI0OujnVVLERABERABlxOQoLu8gVU9ERABERCB+iAgQa+PdlYtRUAEREAEXE5Agu7yBlb1REAEREAE6oOABL0+2lm1FAEREAERcDkBCbrLG1jVEwEREAERqA8CEvT6aGfVUgREQAREwOUEJOgub2BVTwREQAREoD4ISNDro51VSxEQAREQAZcTkKC7vIFVPREQAREQgfogIEGvj3ZWLUVABERABFxOQILu8gZW9URABERABOqDgAS9PtpZtRQBERABEXA5AQm6yxtY1RMBERABEagPAhL0+mhn1VIEREAERMDlBCToLm9gVU8EREAERKA+CEjQ66OdVUsREAEREAGXE5Cgu7yBVT0REAEREIH6ICBBr492Vi1FQAREQARcTkCC7vIGVvVEQAREQATqg4AEvT7aWbUUAREQARFwOQEJussbWNUTAREQARGoDwIS9PpoZ9VSBERABETA5QQk6C5vYFVPBERABESgPghI0OujnVVLERABERABlxOQoLu8gVU9ERABERCB+iAgQa+PdlYtRUAEREAEXE5Agu7yBlb1REAEREAE6oOABL0+2lm1FAEREAERcDkBCbrLG1jVEwEREAERqA8CEvT6aGfVUgREQAREwOUEJOgub2BVTwREQAREoD4ISNDro51VSxEQAREQAZcTkKC7vIFVPREQAREQgfogIEGvj3ZWLUVABERABFxOQILu8gZW9URABERABOqDgAS9PtpZtRQBERABEXA5AQm6yxtY1RMBERABEagPAhL0+mhn1VIEREAERMDlBCToLm9gVU8EREAERKA+CEjQ66OdVUsREAEREAGXE5Cgu7yBVT0REAEREIH6ICBBr492Vi1FQAREQARcTkCC7vIGVvVEQAREQATqg4AEvT7aWbUUAREQARFwOQEJussbWNUTAREQARGoDwIS9PpoZ9VSBERABETA5QQk6C5vYFVPBERABESgPghI0OujnVVLERABERABlxOQoLu8gVU9ERABERCB+iAgQa+PdlYtRUAEREAEXE5Agu7yBlb1REAEREAE6oOABL0+2lm1FAEREAERcDkBCbrLG1jVEwEREAERqA8CEvT6aGfVUgREQAREwOUEJOgub2BVTwREQAREoD4ISNDro51VSxEQAREQAZcTkKC7vIFVPREQAREQgfogIEGvj3ZWLUVABERABFxOQILu8gZW9URABERABOqDgAS9PtpZtRQBERABEXA5AQm6yxtY1RMBERABEagPAhL0+mhn1VIEREAERMDlBCToLm9gVU8EREAERKA+CEjQ66OdVUsREAEREAGXE5Cgu7yBVT0REAEREIH6ICBBr492Vi1FQAREQARcTkCC7vIGVvVEQAREQATqg4AEvT7aWbUUAREQARFwOQEJussbWNUTAREQARGoDwIS9PpoZ9VSBERABETA5QQk6C5vYFVPBERABESgPghI0OujnVVLERABERABlxP4/1KxAthwZDObAAAAAElFTkSuQmCC";

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

/* Draws the real BigMArkt logo PNG, recolored white for canvas cards. */
function _loadLogoImage(fontSize) {
  return new Promise((resolve) => {
    const f = fontSize || 48;
    const original = new Image();
    original.onload = () => {
      const targetH = Math.ceil(f * 1.15);
      const targetW = Math.ceil((original.naturalWidth / original.naturalHeight) * targetH);
      const tmp = document.createElement('canvas');
      tmp.width  = targetW;
      tmp.height = targetH;
      const tc = tmp.getContext('2d');
      tc.drawImage(original, 0, 0, targetW, targetH);
      const imgData = tc.getImageData(0, 0, targetW, targetH);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 15) continue;
        d[i]     = 245;
        d[i + 1] = 245;
        d[i + 2] = 245;
      }
      tc.putImageData(imgData, 0, 0);
      const result = new Image();
      result.onload  = () => resolve(result);
      result.onerror = () => resolve(null);
      result.src = tmp.toDataURL('image/png');
    };
    original.onerror = () => resolve(null);
    original.src = BM_LOGO_B64;
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
