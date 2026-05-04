/* ================================================
   BIGMARKT TRADE JOURNAL — trades.js
   Trade CRUD, form handling, edit modal,
   screenshot upload, export functions
   ================================================ */

/* ---------- SUPABASE TRADE OPERATIONS ---------- */
async function loadTrades() {
    if (!state.user) return;
    showSpinner('LOADING TRADES…');
    const { data, error } = await _sb.from('trades')
      .select('*')
      .eq('user_id', state.user.id)
      .order('created_at', { ascending: false });
    hideSpinner();
    if (error) { console.error(error); return; }
    state.trades = (data || []).map(t => ({
      ...t,
      created_at: new Date(t.created_at).getTime(),
      pnl: Number(t.pnl) || 0,
      rr_ratio: Number(t.rr_ratio) || 0
    }));
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
  
  async function deleteAllTrades() {
    if (!confirm('Delete ALL your trades permanently? This cannot be undone.')) return;
    if (!confirm('Are you absolutely sure? All your trading history will be gone.')) return;
    showSpinner('DELETING ALL TRADES…');
    const { error } = await _sb.from('trades').delete().eq('user_id', state.user.id);
    hideSpinner();
    if (error) { toast('Error deleting trades.', 'error'); return; }
    await loadTrades();
    toast('All trades deleted.');
    renderDashboard();
    renderProfile();
  }
  
  /* ---------- TRADE FORM ---------- */
  function resetTradeForm() {
    document.getElementById('tradeForm').reset();
    state.formDirection = 'BUY';
    state.formResult    = 'WIN';
    state.formGrade     = null;
    state.formTags      = [];
    syncToggleGroups();
    syncGradeButtons();
    syncTagChips();
    document.getElementById('pairSelect').value = 'XAU/USD';
    document.getElementById('pairWrap').classList.remove('custom');
    document.getElementById('pairCustom').value = '';
    screenshotFile    = null;
    clearScreenshot();
    document.getElementById('pnlAutoCalc').classList.remove('show');
    document.getElementById('rrAutoCalc').classList.remove('show');
  }
  
  function setDefaultTradeDate() {
    const el = document.getElementById('tradeDate');
    if (el && !el.value) {
      const now = new Date();
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString().slice(0, 16);
      el.value = local;
    }
  }
  
  function syncToggleGroups() {
    document.querySelectorAll('#directionGroup button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === state.formDirection);
    });
    document.querySelectorAll('#resultGroup button').forEach(b => {
      b.classList.toggle('active', b.dataset.value === state.formResult);
    });
  }
  
  /* ---------- SETUP GRADE ---------- */
  const GRADE_CLASSES = { 'A+': 'active-aplus', 'A': 'active-a', 'B': 'active-b', 'C': 'active-c', 'D': 'active-d' };
  
  function syncGradeButtons() {
    document.querySelectorAll('#gradeGroup .grade-btn').forEach(b => {
      b.className = 'grade-btn';
      if (b.dataset.grade === state.formGrade) b.classList.add(GRADE_CLASSES[b.dataset.grade] || 'active-b');
    });
  }
  
  /* ---------- TAGS ---------- */
  function syncTagChips() {
    document.querySelectorAll('#tagsWrap .tag-chip').forEach(chip => {
      chip.classList.toggle('selected', state.formTags.includes(chip.dataset.tag));
    });
  }
  
  /* ---------- AUTO CALC PNL / RR ---------- */
  function autoCalcPnLRR() {
    const entry  = parseFloat(document.getElementById('entryPrice').value);
    const exit   = parseFloat(document.getElementById('exitPrice').value);
    const sl     = parseFloat(document.getElementById('stopLoss').value);
    const lot    = parseFloat(document.getElementById('lotSize').value);
    const dir    = state.formDirection;
  
    if (!entry || !exit || !lot) return;
  
    // PnL auto-calc
    const diff   = dir === 'BUY' ? exit - entry : entry - exit;
    const pnl    = diff * lot * 100;
    const pnlEl  = document.getElementById('pnl');
    pnlEl.value  = pnl.toFixed(2);
    document.getElementById('pnlAutoCalc').classList.add('show');
  
    // RR auto-calc
    if (sl && entry !== sl) {
      const risk   = Math.abs(entry - sl);
      const reward = Math.abs(exit - entry);
      const rr     = reward / risk;
      document.getElementById('rr').value = rr.toFixed(2);
      document.getElementById('rrAutoCalc').classList.add('show');
    }
  }
  
  function autoCalcEditPnL() {
    const entry = parseFloat(document.getElementById('editEntry')?.value);
    const exit  = parseFloat(document.getElementById('editExit')?.value);
    const sl    = parseFloat(document.getElementById('editSL')?.value);
    const lot   = parseFloat(document.getElementById('editLot')?.value);
    const dir   = document.getElementById('editDirection')?.value;
    if (!entry || !exit || !lot) return;
    const diff  = dir === 'BUY' ? exit - entry : entry - exit;
    const pnl   = diff * lot * 100;
    const pnlEl = document.getElementById('editPnL');
    if (pnlEl) pnlEl.value = pnl.toFixed(2);
    if (sl && entry !== sl) {
      const rr = Math.abs(exit - entry) / Math.abs(entry - sl);
      const rrEl = document.getElementById('editRR');
      if (rrEl) rrEl.value = rr.toFixed(2);
    }
  }
  
  /* ---------- EDIT MODAL ---------- */
  let editingTradeId = null;
  
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
        <label>Tags <span style="color:var(--muted-2);font-size:11px;">(comma separated)</span></label>
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
    const localTrade = state.trades.find(t => t.id === editingTradeId);
    if (!localTrade) { toast('Trade not found.', 'error'); return; }
  
    const updates = {
      pair:        document.getElementById('editPair').value.trim().toUpperCase(),
      direction:   document.getElementById('editDirection').value,
      entry_price: parseFloat(document.getElementById('editEntry').value) || null,
      exit_price:  parseFloat(document.getElementById('editExit').value) || null,
      stop_loss:   parseFloat(document.getElementById('editSL').value) || null,
      take_profit: parseFloat(document.getElementById('editTP').value) || null,
      lot_size:    parseFloat(document.getElementById('editLot').value) || null,
      result:      document.getElementById('editResult').value,
      pnl:         parseFloat(document.getElementById('editPnL').value) || 0,
      rr_ratio:    parseFloat(document.getElementById('editRR').value) || null,
      session:     document.getElementById('editSession').value,
      emotions:    document.getElementById('editEmotion').value,
      strategy:    document.getElementById('editStrategy').value,
      notes:       document.getElementById('editNotes').value,
      setup_grade: document.getElementById('editGrade').value || null,
      tags:        document.getElementById('editTags').value.trim() || null,
    };
  
    // Optimistic UI update
    const idx = state.trades.findIndex(t => t.id === editingTradeId);
    if (idx !== -1) state.trades[idx] = { ...state.trades[idx], ...updates };
  
    showSpinner('SAVING…');
    const { error } = await _sb.from('trades').update(updates).eq('id', editingTradeId);
    hideSpinner();
  
    if (error) {
      toast('Save failed: ' + error.message, 'error');
      await loadTrades();
      return;
    }
  
    hideEditModal();
    await loadTrades();
    toast('Trade updated ✅');
    renderJournal();
    renderDashboard();
  }
  
  /* ---------- SCREENSHOT UPLOAD ---------- */
  let screenshotDataUrl = null;
  let screenshotFile    = null;
  
  function previewScreenshot(input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB.', 'error'); return; }
    screenshotFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      screenshotDataUrl = e.target.result;
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
    screenshotFile    = null;
    document.getElementById('screenshotPreview').src = '';
    document.getElementById('screenshotPreview').style.display  = 'none';
    document.getElementById('screenshotPlaceholder').style.display = 'block';
    document.getElementById('screenshotClear').style.display    = 'none';
    document.getElementById('screenshotInput').value = '';
  }
  
  async function uploadScreenshotToStorage(file, userId) {
    if (!file) return null;
    const ext  = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error } = await _sb.storage.from('trade-charts').upload(path, file, {
      contentType: file.type, upsert: false
    });
    if (error) {
      console.error('Storage upload error:', error);
      toast('Screenshot upload failed — trade saved without image.', 'error');
      return null;
    }
    const { data } = _sb.storage.from('trade-charts').getPublicUrl(path);
    return data?.publicUrl || null;
  }
  
  function isBase64Image(str) {
    return str && str.startsWith('data:image');
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
  
  /* ---------- EXPORT ---------- */
  function exportCSV() {
    const headers = ['Date','Pair','Direction','Entry','Exit','SL','TP','Lot','Result','PnL','RR','Session','Emotion','Strategy','Grade','Tags','Notes'];
    const rows = state.trades.map(t => [
      new Date(t.created_at).toLocaleDateString(),
      t.pair, t.direction, t.entry_price, t.exit_price,
      t.stop_loss || '', t.take_profit || '', t.lot_size,
      t.result, t.pnl, t.rr_ratio || '', t.session,
      t.emotions, t.strategy, t.setup_grade || '', t.tags || '',
      '"' + (t.notes || '').replace(/"/g, '""') + '"'
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    downloadFile('bigmarkt-trades.csv', 'text/csv', csv);
    toast('CSV downloaded! 📊');
  }
  
  function exportPDF() {
    const win = window.open('', '_blank');
    const rows = state.trades.map(t => `
      <tr>
        <td>${new Date(t.created_at).toLocaleDateString()}</td>
        <td><strong>${t.pair}</strong></td>
        <td>${t.direction}</td>
        <td>${t.result}</td>
        <td style="color:${t.pnl>0?'green':t.pnl<0?'red':'gray'}">${t.pnl >= 0 ? '+' : ''}$${Number(t.pnl).toFixed(2)}</td>
        <td>${t.rr_ratio || '—'}</td>
        <td>${t.session}</td>
        <td>${t.setup_grade || '—'}</td>
      </tr>`).join('');
  
    const totalPnL = state.trades.reduce((s,t) => s + (Number(t.pnl)||0), 0);
    const wins  = state.trades.filter(t => t.result === 'WIN').length;
    const total = state.trades.filter(t => t.result !== 'BREAKEVEN').length;
    const wr    = total ? Math.round(wins/total*100) : 0;
  
    win.document.write(`
      <html><head><title>BigMarkt Trade Journal</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
        h1 { color: #D4AF37; } h2 { color: #333; font-size: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
        th { background: #0A0A0A; color: #D4AF37; padding: 8px 10px; text-align: left; }
        td { padding: 7px 10px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) { background: #f9f9f9; }
        .summary { display: flex; gap: 30px; margin: 20px 0; flex-wrap: wrap; }
        .sum-card { background: #f5f5f5; border-radius: 8px; padding: 14px 20px; }
        .sum-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
        .sum-value { font-size: 24px; font-weight: 800; color: #D4AF37; }
      </style>
      </head><body>
      <h1>BigMarkt Trade Journal</h1>
      <h2>Report generated: ${new Date().toLocaleString()}</h2>
      <div class="summary">
        <div class="sum-card"><div class="sum-label">Total Trades</div><div class="sum-value">${state.trades.length}</div></div>
        <div class="sum-card"><div class="sum-label">Win Rate</div><div class="sum-value">${wr}%</div></div>
        <div class="sum-card"><div class="sum-label">Total PnL</div><div class="sum-value" style="color:${totalPnL>=0?'green':'red'}">${totalPnL>=0?'+':''}$${totalPnL.toFixed(2)}</div></div>
      </div>
      <table>
        <thead><tr><th>Date</th><th>Pair</th><th>Dir</th><th>Result</th><th>PnL</th><th>RR</th><th>Session</th><th>Grade</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:30px; font-size:12px; color:#999;">Built for traders · By traders · BigMarkt</p>
      </body></html>`);
    win.document.close();
    win.print();
    toast('PDF print dialog opened! 📄');
  }
  
  function downloadFile(filename, type, content) {
    const blob = new Blob([content], { type });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  /* ---------- SHARE / REFERRAL ---------- */
  function getReferralLink() {
    if (!state.user) return '';
    const refCode = btoa(state.user.id).replace(/=/g, '').substring(0, 12);
    return `https://journal.bigmarkt.co?ref=${refCode}`;
  }
  
  function copyReferralLink() {
    const link = getReferralLink();
    navigator.clipboard.writeText(link).then(() => toast('Referral link copied! 🔗'));
  }
  
  function shareToWhatsApp() {
    const link = getReferralLink();
    window.open(`https://wa.me/?text=I%20use%20BigMarkt%20Journal%20to%20track%20my%20trades%20%F0%9F%93%88%20It%27s%20free!%20${encodeURIComponent(link)}`);
  }
  
  function shareToTelegram() {
    const link = getReferralLink();
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=Free%20trading%20journal%20for%20serious%20traders`);
  }
  
  function shareToTwitter() {
    const link = getReferralLink();
    window.open(`https://twitter.com/intent/tweet?text=I%20track%20my%20trades%20with%20BigMarkt%20Journal%20%F0%9F%93%88%20Free%20for%20all%20traders!&url=${encodeURIComponent(link)}`);
  }
  
  function shareGeneral() {
    const link = getReferralLink();
    if (navigator.share) {
      navigator.share({ title: 'BigMarkt Trade Journal', text: 'Free trading journal for serious traders', url: link });
    } else {
      navigator.clipboard.writeText(link).then(() => toast('Link copied! Share it anywhere 🔗'));
    }
  }