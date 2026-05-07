/* ====================================================
   ADD TRADE FORM
   ==================================================== */
function resetTradeForm() {
  document.getElementById('tradeForm').reset();
  state.formDirection = 'BUY';
  state.formResult = 'WIN';
  state.formGrade = null;
  state.formTags = [];
  syncToggleGroups();
  syncGradeButtons();
  syncTagChips();
  document.getElementById('pairSelect').value = 'XAU/USD';
  document.getElementById('pairWrap').classList.remove('custom');
  document.getElementById('pairCustom').value = '';
  screenshotFile = null;
  clearScreenshot();
  document.getElementById('pnlAutoCalc').classList.remove('show');
  document.getElementById('rrAutoCalc').classList.remove('show');
}

function syncToggleGroups() {
  document.querySelectorAll('#directionGroup button').forEach(b => {
    b.classList.toggle('active', b.dataset.value === state.formDirection);
  });
  document.querySelectorAll('#resultGroup button').forEach(b => {
    b.classList.toggle('active', b.dataset.value === state.formResult);
  });
}

function syncGradeButtons() {
  document.querySelectorAll('#gradeGroup .grade-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.grade === state.formGrade);
  });
}

function syncTagChips() {
  document.querySelectorAll('#tagsWrap .tag-chip').forEach(chip => {
    chip.classList.toggle('active', state.formTags.includes(chip.dataset.tag));
  });
}

/* ====================================================
   DOM READY — attach all event listeners once DOM is ready
   ==================================================== */
document.addEventListener('DOMContentLoaded', () => {

/* ---------- direction + result toggles ---------- */
document.querySelectorAll('#directionGroup button').forEach(b => {
  b.addEventListener('click', () => { state.formDirection = b.dataset.value; syncToggleGroups(); });
});
document.querySelectorAll('#resultGroup button').forEach(b => {
  b.addEventListener('click', () => { state.formResult = b.dataset.value; syncToggleGroups(); });
});

/* ---------- grade buttons ---------- */
document.querySelectorAll('#gradeGroup .grade-btn').forEach(b => {
  b.addEventListener('click', () => {
    state.formGrade = state.formGrade === b.dataset.grade ? null : b.dataset.grade;
    syncGradeButtons();
  });
});

/* ---------- tag chips ---------- */
document.querySelectorAll('#tagsWrap .tag-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const tag = chip.dataset.tag;
    const idx = state.formTags.indexOf(tag);
    if (idx === -1) state.formTags.push(tag);
    else state.formTags.splice(idx, 1);
    syncTagChips();
  });
});

/* ---------- pair selector ---------- */
document.getElementById('pairSelect').addEventListener('change', e => {
  const wrap = document.getElementById('pairWrap');
  if (e.target.value === '__custom') { wrap.classList.add('custom'); document.getElementById('pairCustom').focus(); }
  else wrap.classList.remove('custom');
});

/* ---------- trade form submit ---------- */
document.getElementById('tradeForm').addEventListener('submit', async e => {
  e.preventDefault();
  let pair = document.getElementById('pairSelect').value;
  if (pair === '__custom') {
    pair = document.getElementById('pairCustom').value.trim().toUpperCase();
    if (!pair) { toast('Enter a pair.', 'error'); return; }
  }
  const tradeDateVal = document.getElementById('tradeDate').value;
  const tradeTimestamp = tradeDateVal ? new Date(tradeDateVal).toISOString() : new Date().toISOString();

  // Upload screenshot to Supabase Storage if a file is selected
  let imageUrl = null;
  if (screenshotFile) {
    showSpinner('UPLOADING CHART…');
    imageUrl = await uploadScreenshotToStorage(screenshotFile, state.user.id);
    hideSpinner();
  }

  const trade = {
    user_id: state.user.id,
    created_at: tradeTimestamp,
    pair,
    direction: state.formDirection,
    entry_price: parseFloat(document.getElementById('entryPrice').value),
    exit_price: parseFloat(document.getElementById('exitPrice').value),
    stop_loss: parseFloat(document.getElementById('stopLoss').value) || null,
    take_profit: parseFloat(document.getElementById('takeProfit').value) || null,
    lot_size: parseFloat(document.getElementById('lotSize').value),
    result: state.formResult,
    pnl: parseFloat(document.getElementById('pnl').value),
    rr_ratio: parseFloat(document.getElementById('rr').value) || null,
    session: document.getElementById('session').value,
    emotions: document.getElementById('emotions').value,
    strategy: document.getElementById('strategy').value,
    notes: document.getElementById('notes').value,
    setup_grade: state.formGrade || null,
    tags: state.formTags.length > 0 ? state.formTags.join(',') : null,
    image_url: imageUrl
  };
  const ok = await saveTrade(trade);
  if (ok) {
    toast('Trade logged. ' + (trade.result === 'WIN' ? 'Stack the wins.' : trade.result === 'LOSS' ? 'Learn and move on.' : 'Lock it in.'));
    navigate('dashboard');
  }
});

}); /* ── END DOMContentLoaded ── */
