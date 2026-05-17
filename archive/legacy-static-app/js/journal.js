/* ---------- JOURNAL ---------- */
function switchJournalView(view) {
  state.journalView = view;

  // Always hide all three panels first
  document.getElementById('journalTableView').style.display  = 'none';
  document.getElementById('journalCalView').style.display    = 'none';
  document.getElementById('journalReportView').style.display = 'none';

  // Remove active from all tab buttons
  document.getElementById('btnTableView').classList.remove('active');
  document.getElementById('btnCalView').classList.remove('active');
  document.getElementById('btnReportView').classList.remove('active');

  // Show only the selected panel
  if (view === 'calendar') {
    document.getElementById('journalCalView').style.display = 'block';
    document.getElementById('btnCalView').classList.add('active');
    state.calYear  = new Date().getFullYear();
    state.calMonth = new Date().getMonth();
    renderCalendar();
  } else if (view === 'reports') {
    document.getElementById('journalReportView').style.display = 'block';
    document.getElementById('btnReportView').classList.add('active');
    renderReports();
  } else {
    document.getElementById('journalTableView').style.display = 'block';
    document.getElementById('btnTableView').classList.add('active');
    renderJournal();
  }
}

function renderJournal() {
  const pairs = Array.from(new Set(state.trades.map(t => t.pair))).sort();
  const sel = document.getElementById('filterPair');
  const currentVal = sel.value;
  sel.innerHTML = '<option value="">All Pairs</option>' + pairs.map(p => `<option ${p===currentVal?'selected':''}>${p}</option>`).join('');

  const fp = sel.value;
  const fr = document.getElementById('filterResult').value;
  const fs = document.getElementById('filterSession').value;
  const sort = document.getElementById('filterSort').value;

  let list = state.trades.slice();
  if (fp) list = list.filter(t => t.pair === fp);
  if (fr) list = list.filter(t => t.result === fr);
  if (fs) list = list.filter(t => t.session === fs);

  if (sort === 'newest') list.sort((a,b) => b.created_at - a.created_at);
  if (sort === 'oldest') list.sort((a,b) => a.created_at - b.created_at);
  if (sort === 'pnl_high') list.sort((a,b) => Number(b.pnl) - Number(a.pnl));
  if (sort === 'pnl_low') list.sort((a,b) => Number(a.pnl) - Number(b.pnl));

  const c = document.getElementById('journalContainer');

  // Load-more footer — shown outside the table regardless of filter state
  const loadMoreHtml = state.hasMore
    ? `<div id="loadMoreWrap" style="text-align:center; padding:20px 0 8px;">
         <button id="loadMoreBtn" onclick="loadMoreTrades()"
           style="font-family:'Bebas Neue',sans-serif; letter-spacing:0.12em; font-size:15px;
                  padding:12px 32px; border:1.5px solid var(--gold); background:var(--black);
                  color:var(--gold); border-radius:8px; cursor:pointer; width:100%; max-width:320px;
                  transition:opacity 0.2s;">
           LOAD MORE TRADES
         </button>
       </div>`
    : (state.trades.length > 0
        ? `<div style="text-align:center; padding:16px 0 8px;">
             <p style="color:var(--muted-2); font-size:12px; font-family:'Inter',sans-serif; letter-spacing:0.06em;">All trades loaded</p>
           </div>`
        : '');

  if (list.length === 0) {
    c.innerHTML = `<div class="empty-state"><div class="empty-state-icon">∅</div><div class="empty-state-title">NO TRADES MATCH</div><div class="text-muted small">Try clearing the filters.</div></div>${loadMoreHtml}`;
    return;
  }

  c.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Date</th><th>Pair</th><th>Dir</th><th>Entry</th><th>Exit</th><th>Lot</th><th>Result</th><th>PnL</th><th>RR</th><th>Grade</th><th>Tags</th><th>Session</th><th>Emotion</th><th>Strategy</th><th>Vis</th><th>Chart</th><th></th></tr></thead>
        <tbody>
          ${list.map(t => `
            <tr>
              <td class="num text-muted" style="white-space:nowrap;min-width:100px;">${fmtDateTime(t.created_at)}</td>
              <td class="pair-cell">${t.pair}</td>
              <td>${pillDir(t.direction)}</td>
              <td class="num">${t.entry_price}</td>
              <td class="num">${t.exit_price}</td>
              <td class="num text-muted">${t.lot_size}</td>
              <td>${pillResult(t.result)}</td>
              <td class="num ${t.pnl > 0 ? 'text-win' : t.pnl < 0 ? 'text-loss' : ''}">${fmtMoney(t.pnl)}</td>
              <td class="num text-muted">${t.rr_ratio || '—'}</td>
              <td>${t.setup_grade ? `<span class="pill" style="background:rgba(212,175,55,0.18);color:var(--gold);">${t.setup_grade}</span>` : '<span style="color:var(--muted-2);font-size:11px;">—</span>'}</td>
              <td style="max-width:120px;">${t.tags ? t.tags.split(',').map(tag => `<span style="display:inline-block;background:rgba(212,175,55,0.1);border:1px solid rgba(212,175,55,0.25);color:var(--muted);border-radius:10px;padding:2px 7px;font-size:10px;margin:2px 2px 2px 0;">${tag.trim()}</span>`).join('') : '<span style="color:var(--muted-2);font-size:11px;">—</span>'}</td>
              <td class="text-muted small">${t.session}</td>
              <td class="text-muted small">${t.emotions}</td>
              <td class="text-muted small">${t.strategy}</td>
              <td style="white-space:nowrap;">${tvBadge(t.id, t.trade_visibility)}</td>
              <td style="white-space:nowrap;">
                ${t.image_url ? `<img src="${t.image_url}" class="trade-thumb" onclick="viewScreenshot('${t.id}')" title="View chart">` : '<span style="color:var(--muted-2);font-size:11px;">—</span>'}
              </td>
              <td style="white-space:nowrap;">
                <button class="logout-btn" style="font-size:11px;padding:4px 8px;margin-right:4px;" onclick="openEditModal('${t.id}')">EDIT</button>
                <button class="logout-btn" style="font-size:11px;padding:4px 8px;margin-right:4px;color:var(--gold);border-color:rgba(212,175,55,0.45);" onclick="openShareModal('${t.id}')">SHR</button>
                <button class="logout-btn" style="font-size:11px;padding:4px 8px;color:var(--loss);border-color:var(--loss);" onclick="deleteTrade('${t.id}')">DEL</button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${loadMoreHtml}`;
}

['filterPair', 'filterResult', 'filterSession', 'filterSort'].forEach(id => {
  document.addEventListener('change', e => { if (e.target.id === id) renderJournal(); });
});

/* ====================================================
   TRADE VISIBILITY — journal badge + inline dropdown
   ==================================================== */
const _TV_LABELS = { public: '🌐', followers_only: '👥', private: '🔒', exclude: '🚫' };
const _TV_NAMES  = { public: 'Public', followers_only: 'Followers', private: 'Private', exclude: 'Exclude' };

function tvBadge(id, vis) {
  const v = vis || 'public';
  const opts = Object.keys(_TV_LABELS).map(k => `
    <div class="tv-dd-opt${k === v ? ' selected' : ''}"
         onclick="updateTradeVisibility('${id}','${k}');this.closest('.tv-badge-wrap').classList.remove('open');event.stopPropagation()">
      ${_TV_LABELS[k]} ${_TV_NAMES[k]}
    </div>`).join('');
  return `<div class="tv-badge-wrap" onclick="event.stopPropagation();this.classList.toggle('open')">
    <span class="tv-badge tv-${v}" title="Visibility: ${_TV_NAMES[v]}">${_TV_LABELS[v]}</span>
    <div class="tv-dropdown">${opts}</div>
  </div>`;
}

async function updateTradeVisibility(id, val) {
  const { error } = await _sb.from('trades')
    .update({ trade_visibility: val })
    .eq('id', id)
    .eq('user_id', state.user.id);
  if (error) { toast('Error updating visibility.', 'error'); return; }
  const idx = state.trades.findIndex(t => t.id === id);
  if (idx !== -1) state.trades[idx] = { ...state.trades[idx], trade_visibility: val };
  clearCache();
  toast('Visibility updated ✅');
  renderJournal();
}

// Close any open tv-dropdown when clicking outside
document.addEventListener('click', () => {
  document.querySelectorAll('.tv-badge-wrap.open').forEach(el => el.classList.remove('open'));
});

/* ---------- CALENDAR HEATMAP ---------- */
function calNav(dir) {
  state.calMonth += dir;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  renderCalendar();
}

function renderCalendar() {
  const { calYear, calMonth } = state;
  const monthName = MONTHS[calMonth].toUpperCase();
  document.getElementById('calMonthLabel').innerHTML = monthName + ' <span>' + calYear + '</span>';

  // Build day → trades map
  const dayMap = {};
  state.trades.forEach(t => {
    const d = new Date(t.created_at);
    if (d.getFullYear() === calYear && d.getMonth() === calMonth) {
      const key = d.getDate();
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push(t);
    }
  });

  // Find max abs PnL for intensity scaling
  const dayPnLs = Object.values(dayMap).map(arr => Math.abs(arr.reduce((s, t) => s + (Number(t.pnl)||0), 0)));
  const maxPnL = Math.max(1, ...dayPnLs);

  // First day of month (0=Sun, convert to Mon-first)
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === calYear && today.getMonth() === calMonth;

  let html = '';
  // Empty cells before first day
  for (let i = 0; i < startOffset; i++) {
    html += `<div class="cal-cell empty"></div>`;
  }

  let winDays = 0, lossDays = 0, monthPnL = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const trades = dayMap[day] || [];
    const dayPnL = trades.reduce((s, t) => s + (Number(t.pnl)||0), 0);
    monthPnL += dayPnL;

    let cellClass = 'no-trade';
    if (trades.length > 0) {
      if (dayPnL > 0) {
        winDays++;
        const intensity = Math.min(1, Math.abs(dayPnL) / maxPnL);
        if (intensity < 0.33) cellClass = 'win-sm';
        else if (intensity < 0.66) cellClass = 'win-md';
        else cellClass = 'win-lg';
      } else if (dayPnL < 0) {
        lossDays++;
        const intensity = Math.min(1, Math.abs(dayPnL) / maxPnL);
        if (intensity < 0.33) cellClass = 'loss-sm';
        else if (intensity < 0.66) cellClass = 'loss-md';
        else cellClass = 'loss-lg';
      } else {
        cellClass = 'breakeven';
      }
    }

    const isToday = isCurrentMonth && today.getDate() === day;
    const dateKey = calYear + '-' + calMonth + '-' + day;

    html += `
      <div class="cal-cell ${cellClass}${isToday ? ' today' : ''}"
           onclick="showCalPopup(event, ${day}, '${dateKey}')"
           title="${trades.length} trade${trades.length !== 1 ? 's' : ''} | ${fmtMoney(dayPnL)}">
        <span class="cal-cell-day">${day}</span>
        ${trades.length > 0 ? `<span class="cal-cell-pnl">${fmtMoney(dayPnL)}</span>` : ''}
      </div>`;
  }

  document.getElementById('calGrid').innerHTML = html;

  // Month summary
  const pnlEl = document.getElementById('calSumPnL');
  pnlEl.textContent = fmtMoney(monthPnL);
  pnlEl.style.color = monthPnL > 0 ? 'var(--win)' : monthPnL < 0 ? 'var(--loss)' : 'var(--gold)';
  document.getElementById('calSumWinDays').textContent = winDays;
  document.getElementById('calSumLossDays').textContent = lossDays;
}

function showCalPopup(event, day, dateKey) {
  const { calYear, calMonth } = state;
  const trades = state.trades.filter(t => {
    const d = new Date(t.created_at);
    return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day;
  });

  if (trades.length === 0) return;

  const popup = document.getElementById('calPopup');
  const dayPnL = trades.reduce((s, t) => s + (Number(t.pnl)||0), 0);
  const wins = trades.filter(t => t.result === 'WIN').length;
  const losses = trades.filter(t => t.result === 'LOSS').length;
  const bestRR = Math.max(...trades.map(t => Number(t.rr_ratio) || 0));
  const avgRR = trades.filter(t => t.rr_ratio).reduce((s,t)=>s+(Number(t.rr_ratio)||0),0) / (trades.filter(t=>t.rr_ratio).length||1);

  document.getElementById('calPopupDate').textContent =
    MONTHS[calMonth] + ' ' + day + ', ' + calYear;

  document.getElementById('calPopupBody').innerHTML = `
    <div class="cal-popup-stat">
      <span class="cal-popup-label">Trades</span>
      <span class="cal-popup-value">${trades.length}</span>
    </div>
    <div class="cal-popup-stat">
      <span class="cal-popup-label">W / L</span>
      <span class="cal-popup-value"><span style="color:var(--win)">${wins}W</span> / <span style="color:var(--loss)">${losses}L</span></span>
    </div>
    <div class="cal-popup-stat">
      <span class="cal-popup-label">Day PnL</span>
      <span class="cal-popup-value" style="color:${dayPnL>0?'var(--win)':dayPnL<0?'var(--loss)':'var(--muted)'}">${fmtMoney(dayPnL)}</span>
    </div>
    <div class="cal-popup-stat">
      <span class="cal-popup-label">Best RR</span>
      <span class="cal-popup-value" style="color:var(--gold)">${bestRR > 0 ? '1:' + bestRR.toFixed(1) : '—'}</span>
    </div>
    <div class="cal-popup-stat">
      <span class="cal-popup-label">Pairs</span>
      <span class="cal-popup-value" style="font-size:11px">${[...new Set(trades.map(t=>t.pair))].join(', ')}</span>
    </div>`;

  // Position popup near click
  const rect = event.target.closest('.cal-cell').getBoundingClientRect();
  const popupW = 260;
  let left = rect.right + 8;
  if (left + popupW > window.innerWidth - 10) left = rect.left - popupW - 8;
  if (left < 8) left = 8;
  let top = rect.top;
  if (top + 220 > window.innerHeight) top = window.innerHeight - 230;

  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
  popup.classList.add('show');
}

function closeCalPopup() {
  document.getElementById('calPopup').classList.remove('show');
}

document.addEventListener('click', e => {
  const popup = document.getElementById('calPopup');
  if (popup && popup.classList.contains('show') && !popup.contains(e.target) && !e.target.closest('.cal-cell')) {
    popup.classList.remove('show');
  }
});

/* ====================================================
   EXPORT FUNCTIONS
   ==================================================== */
function exportCSV() {
  const headers = ['Date','Pair','Direction','Entry','Exit','SL','TP','Lot','Result','PnL','RR','Session','Emotion','Strategy','Notes'];
  const rows = state.trades.map(t => [
    new Date(t.created_at).toLocaleDateString(),
    t.pair, t.direction, t.entry_price, t.exit_price,
    t.stop_loss || '', t.take_profit || '', t.lot_size,
    t.result, t.pnl, t.rr_ratio || '', t.session,
    t.emotions, t.strategy,
    '"' + (t.notes || '').replace(/"/g, '""') + '"'
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  downloadFile('bigmarkt-trades.csv', 'text/csv', csv);
  toast('CSV downloaded! 📊');
}

function exportJSON() {
  const json = JSON.stringify(state.trades, null, 2);
  downloadFile('bigmarkt-trades.json', 'application/json', json);
  toast('JSON downloaded! 📁');
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
      <td>${t.emotions}</td>
    </tr>`).join('');

  const totalPnL = state.trades.reduce((s,t) => s + (Number(t.pnl)||0), 0);
  const wins = state.trades.filter(t => t.result === 'WIN').length;
  const total = state.trades.filter(t => t.result !== 'BREAKEVEN').length;
  const wr = total ? Math.round(wins/total*100) : 0;

  win.document.write(`
    <html><head><title>BigMarkt Trade Journal</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #111; }
      h1 { color: #D4AF37; } h2 { color: #333; font-size: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
      th { background: #0A0A0A; color: #D4AF37; padding: 8px 10px; text-align: left; }
      td { padding: 7px 10px; border-bottom: 1px solid #eee; }
      tr:nth-child(even) { background: #f9f9f9; }
      .summary { display: flex; gap: 30px; margin: 20px 0; }
      .sum-card { background: #f5f5f5; border-radius: 8px; padding: 14px 20px; }
      .sum-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
      .sum-value { font-size: 24px; font-weight: 800; color: #D4AF37; }
    </style>
    </head><body>
    <h1>BigMarkt — FTS Trade Journal</h1>
    <h2>Report generated: ${new Date().toLocaleString()}</h2>
    <div class="summary">
      <div class="sum-card"><div class="sum-label">Total Trades</div><div class="sum-value">${state.trades.length}</div></div>
      <div class="sum-card"><div class="sum-label">Win Rate</div><div class="sum-value">${wr}%</div></div>
      <div class="sum-card"><div class="sum-label">Total PnL</div><div class="sum-value" style="color:${totalPnL>=0?'green':'red'}">${totalPnL>=0?'+':''}$${totalPnL.toFixed(2)}</div></div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Pair</th><th>Dir</th><th>Result</th><th>PnL</th><th>RR</th><th>Session</th><th>Emotion</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:30px; font-size:12px; color:#999;">Built for traders · By traders · BigMarkt</p>
    </body></html>`);
  win.document.close();
  win.print();
  toast('PDF print dialog opened! 📄');
}

/* ====================================================
   WEEKLY / MONTHLY REPORTS
   ==================================================== */
let reportMode = 'weekly';

function switchReport(mode) {
  reportMode = mode;
  document.getElementById('tabWeekly').classList.toggle('active', mode === 'weekly');
  document.getElementById('tabMonthly').classList.toggle('active', mode === 'monthly');
  renderReports();
}

function renderReports() {
  const el = document.getElementById('reportContent');
  if (!el) return;

  if (state.trades.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📊</div><div class="empty-state-title">NO TRADES YET</div><div class="text-muted small">Log trades to generate your reports.</div></div>`;
    return;
  }

  if (reportMode === 'weekly') renderWeeklyReport(el);
  else renderMonthlyReport(el);
}

function getWeekKey(ts) {
  const d = new Date(ts);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function renderWeeklyReport(el) {
  // Group trades by week
  const weeks = {};
  state.trades.forEach(t => {
    const key = getWeekKey(t.created_at);
    if (!weeks[key]) weeks[key] = [];
    weeks[key].push(t);
  });

  const sortedWeeks = Object.keys(weeks).sort().reverse();

  if (sortedWeeks.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-title">NO WEEKLY DATA</div></div>`;
    return;
  }

  el.innerHTML = sortedWeeks.map(week => {
    const trades = weeks[week];
    return buildReportCard('WEEKLY REPORT', week, trades);
  }).join('');
}

function renderMonthlyReport(el) {
  // Group trades by month
  const months = {};
  state.trades.forEach(t => {
    const d = new Date(t.created_at);
    const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if (!months[key]) months[key] = [];
    months[key].push(t);
  });

  const sortedMonths = Object.keys(months).sort().reverse();
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  if (sortedMonths.length === 0) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-title">NO MONTHLY DATA</div></div>`;
    return;
  }

  el.innerHTML = sortedMonths.map(month => {
    const [year, m] = month.split('-');
    const label = monthNames[parseInt(m) - 1] + ' ' + year;
    const trades = months[month];
    return buildReportCard('MONTHLY REPORT', label, trades);
  }).join('');
}

function buildReportCard(type, period, trades) {
  const wins = trades.filter(t => t.result === 'WIN').length;
  const losses = trades.filter(t => t.result === 'LOSS').length;
  const be = trades.filter(t => t.result === 'BREAKEVEN').length;
  const closed = wins + losses;
  const winRate = closed ? Math.round(wins / closed * 100) : 0;
  const totalPnL = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const avgRR = trades.filter(t => t.rr_ratio).length ?
    (trades.filter(t => t.rr_ratio).reduce((s, t) => s + Number(t.rr_ratio), 0) / trades.filter(t => t.rr_ratio).length).toFixed(1) : '—';

  // Best pair
  const byPair = {};
  trades.forEach(t => { byPair[t.pair] = (byPair[t.pair] || 0) + Number(t.pnl); });
  const bestPair = Object.keys(byPair).sort((a, b) => byPair[b] - byPair[a])[0] || '—';

  // Insights
  const insights = [];
  if (winRate >= 60) insights.push({ type: 'good', text: `💪 Strong win rate of ${winRate}% this period. Your entries are on point.` });
  else if (winRate < 40 && closed >= 3) insights.push({ type: 'warning', text: `⚠️ Win rate dropped to ${winRate}%. Review your entry criteria.` });

  if (totalPnL > 0) insights.push({ type: 'good', text: `✅ Profitable period — ${fmtMoney(totalPnL)} net gain. Keep the discipline.` });
  else if (totalPnL < 0) insights.push({ type: 'warning', text: `🔴 Net loss of ${fmtMoney(Math.abs(totalPnL))} this period. Reduce size until form returns.` });

  const fomoCount = trades.filter(t => t.emotions === 'FOMO' && t.result === 'LOSS').length;
  if (fomoCount >= 2) insights.push({ type: 'warning', text: `🚨 ${fomoCount} FOMO losses this period. Wait for confirmation — your gut is costing you.` });

  const revengeCount = trades.filter(t => t.emotions === 'Revenge').length;
  if (revengeCount >= 1) insights.push({ type: 'warning', text: `🛑 ${revengeCount} revenge trade(s) detected. Walk away after losses — protect your capital.` });

  if (insights.length === 0) insights.push({ type: 'good', text: `📊 Consistent logging. Keep tracking every trade for deeper insights.` });

  return `
    <div class="report-card">
      <div class="report-period">${type}</div>
      <div class="report-title">${period}</div>
      <div class="report-stats">
        <div class="report-stat">
          <div class="report-stat-label">Trades</div>
          <div class="report-stat-value">${trades.length}</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-label">Win Rate</div>
          <div class="report-stat-value" style="color:${winRate >= 50 ? 'var(--win)' : 'var(--loss)'}">${winRate}%</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-label">Net PnL</div>
          <div class="report-stat-value" style="color:${totalPnL > 0 ? 'var(--win)' : totalPnL < 0 ? 'var(--loss)' : 'var(--muted)'}">${fmtMoney(totalPnL)}</div>
        </div>
        <div class="report-stat">
          <div class="report-stat-label">Avg RR</div>
          <div class="report-stat-value" style="color:var(--gold)">${avgRR !== '—' ? '1:' + avgRR : '—'}</div>
        </div>
      </div>
      <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
        <span class="pill pill-win">${wins}W</span>
        <span class="pill pill-loss">${losses}L</span>
        ${be > 0 ? `<span class="pill pill-be">${be}BE</span>` : ''}
        <span class="pill" style="background:rgba(212,175,55,0.15);color:var(--gold);">Best: ${bestPair}</span>
      </div>
      ${insights.map(i => `<div class="report-insight ${i.type === 'warning' ? 'warning' : 'good'}">${i.text}</div>`).join('')}
    </div>`;
}

function exportReportPDF() {
  const win = window.open('', '_blank');
  const mode = reportMode === 'weekly' ? 'Weekly' : 'Monthly';
  const content = document.getElementById('reportContent').innerHTML;
  win.document.write(`
    <html><head><title>BigMarkt ${mode} Report</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 30px; color: #111; max-width: 800px; margin: 0 auto; }
      h1 { color: #D4AF37; } h2 { color: #666; font-size: 14px; margin-bottom: 20px; }
      .report-card { border: 1px solid #ddd; border-radius: 10px; padding: 20px; margin-bottom: 20px; }
      .report-period { font-size: 11px; color: #D4AF37; text-transform: uppercase; letter-spacing: 2px; }
      .report-title { font-size: 22px; font-weight: 900; margin: 6px 0 14px; }
      .report-stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 14px; }
      .report-stat { background: #f9f9f9; border-radius: 8px; padding: 10px; }
      .report-stat-label { font-size: 10px; color: #888; text-transform: uppercase; }
      .report-stat-value { font-size: 22px; font-weight: 900; color: #D4AF37; }
      .report-insight { font-size: 13px; padding: 10px 12px; background: #f5f5f5; border-left: 3px solid #D4AF37; border-radius: 6px; margin-bottom: 8px; line-height: 1.5; }
      .report-insight.warning { border-left-color: #ef4444; }
    </style></head><body>
    <h1>BigMarkt FTS Trade Journal</h1>
    <h2>${mode} Performance Report · Generated ${new Date().toLocaleString()}</h2>
    ${content}
    <p style="margin-top:30px;font-size:11px;color:#999;">Built for traders · By traders · BigMarkt · FTS by Jefe S.</p>
    </body></html>`);
  win.document.close();
  win.print();
  toast('Report PDF opened! 📄');
}
