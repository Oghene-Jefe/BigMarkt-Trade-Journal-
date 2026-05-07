/* ---------- TRADES — SUPABASE ---------- */
let screenshotDataUrl = null;   // preview (still base64 for local preview)
let screenshotFile = null;      // raw File object to upload on save
let editingTradeId = null;

async function loadTrades() {
  if (!state.user) return;
  showSpinner('LOADING TRADES…');
  const { data, error } = await _sb.from('trades')
    .select('*')
    .eq('user_id', state.user.id)
    .order('created_at', { ascending: false });
  hideSpinner();
  if (error) { console.error(error); return; }
  // Normalize created_at to timestamp number for compatibility
  state.trades = (data || []).map(t => ({
    ...t,
    created_at: new Date(t.created_at).getTime(),
    pnl: Number(t.pnl) || 0,
    rr_ratio: Number(t.rr_ratio) || 0
  }));
}

async function loadProfile() {
  if (!state.user) return;
  const { data } = await _sb.from('profiles').select('*').eq('id', state.user.id).single();
  state.profile = data || null;
}

async function saveTrade(trade) {
  showSpinner('SAVING TRADE…');
  const { error } = await _sb.from('trades').insert(trade);
  hideSpinner();
  if (error) { toast('Error saving trade: ' + error.message, 'error'); return false; }
  await loadTrades();
  return true;
}

async function deleteTrade(id) {
  if (!confirm('Delete this trade? This cannot be undone.')) return;
  showSpinner('DELETING…');
  const { error } = await _sb.from('trades').delete().eq('id', id).eq('user_id', state.user.id);
  hideSpinner();
  if (error) { toast('Error deleting trade.', 'error'); return; }
  await loadTrades();
  toast('Trade deleted.');
  renderJournal();
}

function openEditModal(id) {
  const t = state.trades.find(x => x.id === id);
  if (!t) return;
  editingTradeId = id;

  document.getElementById('editModalBody').innerHTML = `
    <div class="field">
      <label>Pair</label>
      <input type="text" id="editPair" value="${t.pair}">
    </div>
    <div class="field">
      <label>Direction</label>
      <select id="editDirection" onchange="autoCalcEditPnL()">
        <option ${t.direction==='BUY'?'selected':''}>BUY</option>
        <option ${t.direction==='SELL'?'selected':''}>SELL</option>
      </select>
    </div>
    <div class="field">
      <label>Entry Price</label>
      <input type="number" step="any" id="editEntry" value="${t.entry_price}" oninput="autoCalcEditPnL()">
    </div>
    <div class="field">
      <label>Exit Price</label>
      <input type="number" step="any" id="editExit" value="${t.exit_price}" oninput="autoCalcEditPnL()">
    </div>
    <div class="field">
      <label>Stop Loss</label>
      <input type="number" step="any" id="editSL" value="${t.stop_loss || ''}" oninput="autoCalcEditPnL()">
    </div>
    <div class="field">
      <label>Take Profit</label>
      <input type="number" step="any" id="editTP" value="${t.take_profit || ''}">
    </div>
    <div class="field">
      <label>Lot Size</label>
      <input type="number" step="any" id="editLot" value="${t.lot_size}" oninput="autoCalcEditPnL()">
    </div>
    <div class="field">
      <label>Result</label>
      <select id="editResult">
        <option ${t.result==='WIN'?'selected':''}>WIN</option>
        <option ${t.result==='LOSS'?'selected':''}>LOSS</option>
        <option ${t.result==='BREAKEVEN'?'selected':''}>BREAKEVEN</option>
      </select>
    </div>
    <div class="field">
      <label>PnL ($)</label>
      <input type="number" step="any" id="editPnL" value="${t.pnl}">
    </div>
    <div class="field">
      <label>RR Ratio</label>
      <input type="number" step="any" id="editRR" value="${t.rr_ratio || ''}">
    </div>
    <div class="field">
      <label>Session</label>
      <select id="editSession">
        ${['London','New York','Asian','Overlap'].map(s => `<option ${t.session===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Emotion</label>
      <select id="editEmotion">
        ${['Confident','Patient','Hesitant','FOMO','Revenge'].map(e => `<option ${t.emotions===e?'selected':''}>${e}</option>`).join('')}
      </select>
    </div>
    <div class="field">
      <label>Strategy</label>
      <select id="editStrategy">
        ${['SMC','Scalp','Swing','Breakout','Liquidity Grab'].map(s => `<option ${t.strategy===s?'selected':''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="field full">
      <label>Notes</label>
      <textarea id="editNotes">${t.notes || ''}</textarea>
    </div>
    <div class="field full">
      <label>Setup Grade</label>
      <select id="editGrade">
        <option value="">— None —</option>
        ${['A+','A','B','C','D'].map(g => `<option value="${g}" ${t.setup_grade===g?'selected':''}>${g}</option>`).join('')}
      </select>
    </div>
    <div class="field full">
      <label>Tags <span style="color:var(--muted-2);font-size:11px;font-family:'Inter',sans-serif;letter-spacing:0;">(comma separated)</span></label>
      <input type="text" id="editTags" value="${t.tags || ''}" placeholder="e.g. FOMO, Late Entry">
    </div>
  `;
  document.getElementById('editModal').classList.add('show');
}

function hideEditModal() {
  document.getElementById('editModal').classList.remove('show');
  editingTradeId = null;
}

async function saveEditTrade() {
  if (!editingTradeId) { toast('No trade selected.', 'error'); return; }

  // Verify trade belongs to current user
  const localTrade = state.trades.find(t => t.id === editingTradeId);
  if (!localTrade) { toast('Trade not found.', 'error'); return; }

  const updates = {
    pair: document.getElementById('editPair').value.trim().toUpperCase(),
    direction: document.getElementById('editDirection').value,
    entry_price: parseFloat(document.getElementById('editEntry').value) || null,
    exit_price: parseFloat(document.getElementById('editExit').value) || null,
    stop_loss: parseFloat(document.getElementById('editSL').value) || null,
    take_profit: parseFloat(document.getElementById('editTP').value) || null,
    lot_size: parseFloat(document.getElementById('editLot').value) || null,
    result: document.getElementById('editResult').value,
    pnl: parseFloat(document.getElementById('editPnL').value) || 0,
    rr_ratio: parseFloat(document.getElementById('editRR').value) || null,
    session: document.getElementById('editSession').value,
    emotions: document.getElementById('editEmotion').value,
    strategy: document.getElementById('editStrategy').value,
    notes: document.getElementById('editNotes').value,
    setup_grade: document.getElementById('editGrade').value || null,
    tags: document.getElementById('editTags').value.trim() || null,
  };

  // Update in state immediately for instant UI feedback
  const idx = state.trades.findIndex(t => t.id === editingTradeId);
  if (idx !== -1) {
    state.trades[idx] = { ...state.trades[idx], ...updates };
  }

  showSpinner('SAVING…');
  // Push to Supabase
  const { error } = await _sb
    .from('trades')
    .update(updates)
    .eq('id', editingTradeId).eq('user_id', state.user.id);
  hideSpinner();

  if (error) {
    toast('Save failed: ' + error.message, 'error');
    console.error('Edit error:', error, 'Trade ID:', editingTradeId);
    await loadTrades(); // revert to server state
    return;
  }

  hideEditModal();
  await loadTrades();
  toast('Trade updated ✅');
  renderJournal();
  renderDashboard();
}

/* ====================================================
   AUTO-CALCULATE PnL AND RR
   ==================================================== */
function autoCalcPnLRR() {
  const entry = parseFloat(document.getElementById('entryPrice').value);
  const exit = parseFloat(document.getElementById('exitPrice').value);
  const sl = parseFloat(document.getElementById('stopLoss').value);
  const lot = parseFloat(document.getElementById('lotSize').value);
  const dir = state.formDirection;
  const pair = document.getElementById('pairSelect').value;

  if (!entry || !exit || !lot) return;

  const diff = dir === 'BUY' ? exit - entry : entry - exit;
  let pnl = 0;

  // PnL calculation per instrument type
  if (pair === 'XAU/USD') {
    // Gold: 1 lot = 100 oz, pip = $0.01, so: diff * 100 * lot
    pnl = diff * 100 * lot;
  } else if (pair === 'XAG/USD') {
    // Silver: 1 lot = 5000 oz
    pnl = diff * 5000 * lot;
  } else if (pair === 'US30') {
    // Dow Jones: 1 lot = $1 per point
    pnl = diff * lot * 1;
  } else if (pair === 'NAS100') {
    // Nasdaq: 1 lot = $1 per point
    pnl = diff * lot * 1;
  } else if (pair === 'US500') {
    // S&P 500: 1 lot = $1 per point
    pnl = diff * lot * 1;
  } else if (pair === 'JP225') {
    // Nikkei: 1 lot = ¥100 per point, approx /150 for USD
    pnl = (diff * lot * 100) / 150;
  } else if (pair === 'UK100' || pair === 'GER40') {
    // UK/GER indices: 1 lot = £/€1 per point
    pnl = diff * lot * 1;
  } else if (pair === 'USOIL' || pair === 'UKOIL') {
    // Oil: 1 lot = 1000 barrels
    pnl = diff * lot * 1000;
  } else if (pair === 'BTC/USD') {
    // Crypto: direct price diff * lot
    pnl = diff * lot;
  } else if (pair === 'ETH/USD' || pair === 'XRP/USD') {
    pnl = diff * lot;
  } else if (pair.includes('Boom') || pair.includes('Crash') || pair.includes('Volatility') || pair === 'V75' || pair === 'V25') {
    // Synthetic indices: 1 lot = $1 per point
    pnl = diff * lot * 1;
  } else {
    // Forex standard: 1 lot = 100,000 units, pip = 0.0001
    // For JPY pairs pip = 0.01
    const isJPY = pair.includes('JPY');
    const pipValue = isJPY ? 0.01 : 0.0001;
    pnl = (diff / pipValue) * lot * (isJPY ? 1000 : 10);
  }

  document.getElementById('pnl').value = pnl.toFixed(2);
  document.getElementById('pnlAutoCalc').classList.add('show');

  // Auto RR
  if (sl && entry) {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(exit - entry);
    if (risk > 0) {
      document.getElementById('rr').value = (reward / risk).toFixed(2);
      document.getElementById('rrAutoCalc').classList.add('show');
    }
  }
}

// Attach auto-calc listeners
['entryPrice', 'exitPrice', 'stopLoss', 'lotSize'].forEach(id => {
  document.addEventListener('input', e => {
    if (e.target.id === id) autoCalcPnLRR();
  });
});

/* ====================================================
   AUTO-CALC FOR EDIT MODAL
   ==================================================== */
function autoCalcEditPnL() {
  const entry = parseFloat(document.getElementById('editEntry')?.value);
  const exit = parseFloat(document.getElementById('editExit')?.value);
  const sl = parseFloat(document.getElementById('editSL')?.value);
  const lot = parseFloat(document.getElementById('editLot')?.value);
  const dir = document.getElementById('editDirection')?.value || 'BUY';
  const pair = document.getElementById('editPair')?.value || 'XAU/USD';

  if (!entry || !exit || !lot) return;

  const diff = dir === 'BUY' ? exit - entry : entry - exit;
  let pnl = 0;

  if (pair === 'XAU/USD') pnl = diff * 100 * lot;
  else if (pair === 'XAG/USD') pnl = diff * 5000 * lot;
  else if (['US30','NAS100','US500','UK100','GER40'].includes(pair)) pnl = diff * lot;
  else if (pair === 'JP225') pnl = (diff * lot * 100) / 150;
  else if (pair === 'USOIL' || pair === 'UKOIL') pnl = diff * lot * 1000;
  else if (['BTC/USD','ETH/USD','XRP/USD'].includes(pair)) pnl = diff * lot;
  else if (pair.includes('Boom') || pair.includes('Crash') || pair.includes('Volatility') || pair === 'V75' || pair === 'V25') pnl = diff * lot;
  else {
    const isJPY = pair.includes('JPY');
    const pipValue = isJPY ? 0.01 : 0.0001;
    pnl = (diff / pipValue) * lot * (isJPY ? 1000 : 10);
  }

  const pnlEl = document.getElementById('editPnL');
  if (pnlEl) pnlEl.value = pnl.toFixed(2);

  // Auto RR
  if (sl && entry) {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(exit - entry);
    if (risk > 0) {
      const rrEl = document.getElementById('editRR');
      if (rrEl) rrEl.value = (reward / risk).toFixed(2);
    }
  }
}

function viewScreenshot(tradeId) {
  const trade = state.trades.find(t => t.id === tradeId);
  if (!trade || !trade.image_url) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;cursor:pointer;';
  overlay.innerHTML = `<img src="${trade.image_url}" style="max-width:100%;max-height:90vh;border-radius:10px;border:1px solid #D4AF37;">`;
  overlay.onclick = () => document.body.removeChild(overlay);
  document.body.appendChild(overlay);
}

/* ====================================================
   SCREENSHOT UPLOAD — SUPABASE STORAGE
   New trades: upload to 'trade-charts' bucket, store public URL
   Old trades: image_url may be a base64 string — display as-is
   ==================================================== */
function previewScreenshot(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB.', 'error'); return; }
  screenshotFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    screenshotDataUrl = e.target.result; // local preview only
    document.getElementById('screenshotPreview').src = screenshotDataUrl;
    document.getElementById('screenshotPreview').style.display = 'block';
    document.getElementById('screenshotPlaceholder').style.display = 'none';
    document.getElementById('screenshotClear').style.display = 'block';
    toast('Chart ready — will upload on save ✅');
  };
  reader.readAsDataURL(file);
}

function clearScreenshot() {
  screenshotDataUrl = null;
  screenshotFile = null;
  document.getElementById('screenshotPreview').src = '';
  document.getElementById('screenshotPreview').style.display = 'none';
  document.getElementById('screenshotPlaceholder').style.display = 'block';
  document.getElementById('screenshotClear').style.display = 'none';
  document.getElementById('screenshotInput').value = '';
}

// Upload file to Supabase Storage → return public URL or null
async function uploadScreenshotToStorage(file, userId) {
  if (!file) return null;
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await _sb.storage
    .from('trade-charts')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    console.error('Storage upload error:', error);
    toast('Screenshot upload failed — trade saved without image.', 'error');
    return null;
  }
  const { data } = _sb.storage.from('trade-charts').getPublicUrl(path);
  return data?.publicUrl || null;
}

// Detect if a URL is base64 (old trades) vs a real URL (new trades from Storage)
function isBase64Image(str) {
  return str && str.startsWith('data:image');
}

/* ====================================================
   DATE PICKER DEFAULT
   ==================================================== */
function setDefaultTradeDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  const local = new Date(now - offset);
  const formatted = local.toISOString().slice(0, 16);
  const el = document.getElementById('tradeDate');
  if (el) el.value = formatted;
}
