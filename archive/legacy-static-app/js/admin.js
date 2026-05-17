/* ====================================================
   ADMIN PANEL
   ==================================================== */
function switchAdminTab(tab) {
  const tabs = ['overview', 'users', 'leaderboard', 'activity', 'stats'];
  tabs.forEach(t => {
    const panel = document.getElementById('adm-tab-' + t);
    const btn   = document.getElementById('adm-tab-btn-' + t);
    if (panel) panel.style.display = t === tab ? '' : 'none';
    if (btn)   btn.classList.toggle('active', t === tab);
  });
}

async function renderAdmin() {
  if (!isAdmin()) return;
  showSpinner('LOADING ADMIN DATA…');
  const [{ data: profiles }, { data: allTrades }, { data: allResets }] = await Promise.all([
    _sb.from('profiles').select('*').order('created_at', { ascending: false }),
    _sb.from('trades').select('*').order('created_at', { ascending: false }),
    _sb.from('balance_resets').select('user_id').order('created_at', { ascending: false })
  ]);
  hideSpinner();
  const p = profiles || [];
  const t = allTrades || [];
  const r = allResets || [];
  _renderAdminOverview(p, t);
  _renderAdminUsers(p, t, r);
  _renderAdminReferrals(p, t);
  _renderAdminActivity(p, t);
  _renderAdminSystemStats(t, p);
}

function _renderAdminOverview(profiles, trades) {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();

  const totalUsers  = profiles.length;
  const newWeek     = profiles.filter(p => new Date(p.created_at).getTime() >= weekAgo).length;
  const newMonth    = profiles.filter(p => new Date(p.created_at).getTime() >= monthStart).length;
  const totalPnL    = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  const wins        = trades.filter(t => t.result === 'WIN').length;
  const losses      = trades.filter(t => t.result === 'LOSS').length;
  const closed      = wins + losses;
  const winRate     = closed > 0 ? Math.round((wins / closed) * 100) : null;
  const avgTrades   = totalUsers > 0 ? (trades.length / totalUsers).toFixed(1) : '—';

  const pairCounts = {};
  trades.forEach(t => { if (t.pair) pairCounts[t.pair] = (pairCounts[t.pair] || 0) + 1; });
  const topPair = Object.entries(pairCounts).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('adm-totalUsers').textContent    = totalUsers;
  document.getElementById('adm-totalUsersFoot').textContent = totalUsers === 1 ? '1 registered account' : totalUsers + ' registered accounts';
  document.getElementById('adm-totalTrades').textContent   = trades.length;
  const pnlEl = document.getElementById('adm-totalPnL');
  pnlEl.textContent = fmtMoney(totalPnL);
  pnlEl.classList.remove('win','loss');
  if (totalPnL > 0) pnlEl.classList.add('win');
  else if (totalPnL < 0) pnlEl.classList.add('loss');
  document.getElementById('adm-winRate').textContent  = winRate === null ? '—' : winRate + '%';
  document.getElementById('adm-newWeek').textContent  = newWeek;
  document.getElementById('adm-newMonth').textContent = newMonth;
  document.getElementById('adm-topPair').textContent  = topPair ? topPair[0] : '—';
  document.getElementById('adm-topPairFoot').textContent = topPair ? topPair[1] + ' trades' : 'no trades yet';
  document.getElementById('adm-avgTrades').textContent = avgTrades;
}

function _renderAdminUsers(profiles, trades, resets) {
  const el = document.getElementById('adm-usersTable');
  if (profiles.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">◆</div><div class="empty-state-title">NO USERS YET</div></div>';
    return;
  }
  const tradeCounts = {};
  const lastTradeDates = {};
  const userPnL = {};
  trades.forEach(t => {
    if (!t.user_id) return;
    tradeCounts[t.user_id] = (tradeCounts[t.user_id] || 0) + 1;
    userPnL[t.user_id] = (userPnL[t.user_id] || 0) + (Number(t.pnl) || 0);
    const ts = new Date(t.created_at).getTime();
    if (!lastTradeDates[t.user_id] || ts > lastTradeDates[t.user_id]) lastTradeDates[t.user_id] = ts;
  });
  const resetCounts = {};
  (resets || []).forEach(r => { if (r.user_id) resetCounts[r.user_id] = (resetCounts[r.user_id] || 0) + 1; });
  const rows = profiles.map(p => {
    const count = tradeCounts[p.id] || 0;
    const lastTs = lastTradeDates[p.id];
    const lastDate = lastTs ? fmtDate(lastTs) : '—';
    const joined = p.created_at ? fmtDate(new Date(p.created_at).getTime()) : '—';
    const srcPill = p.source ? `<span class="pill ${p.source === 'signup' ? 'pill-win' : p.source === 'google' ? 'pill-buy' : 'pill-be'}">${p.source}</span>` : '—';
    const startBal = p.starting_balance != null ? Number(p.starting_balance) : null;
    const pnl = userPnL[p.id] || 0;
    const growthPct = startBal ? (pnl / startBal * 100) : null;
    const startBalCell = startBal != null ? fmtMoney(startBal) : '<span style="color:var(--muted-2)">—</span>';
    const growthCell = growthPct != null
      ? `<span style="color:${growthPct >= 0 ? 'var(--win)' : 'var(--loss)'}">${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(1)}%</span>`
      : '<span style="color:var(--muted-2)">—</span>';
    const rCount = resetCounts[p.id] || 0;
    const resetsCell = rCount > 0 ? `<span style="color:var(--muted);">${rCount}</span>` : '<span style="color:var(--muted-2)">—</span>';
    return `<tr>
      <td>${p.name ? escHtml(p.name) : '<span style="color:var(--muted-2)">—</span>'}</td>
      <td class="num" style="font-size:12px;">${p.email ? escHtml(p.email) : '—'}</td>
      <td>${srcPill}</td>
      <td class="num text-muted" style="font-size:12px;">${joined}</td>
      <td class="num" style="text-align:center;">${count}</td>
      <td class="num text-muted" style="font-size:12px;">${lastDate}</td>
      <td class="num" style="font-size:12px;">${startBalCell}</td>
      <td class="num" style="font-size:12px;">${growthCell}</td>
      <td class="num" style="text-align:center;">${resetsCell}</td>
      <td><button class="admin-delete-btn" onclick="adminDeleteUser('${p.id}','${escHtml(p.name || p.email || p.id)}')">DELETE</button></td>
    </tr>`;
  }).join('');
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Email</th><th>Source</th><th>Joined</th><th style="text-align:center;">Trades</th><th>Last Trade</th><th>Start Bal</th><th>Growth</th><th style="text-align:center;">Resets</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function _renderAdminReferrals(profiles, trades) {
  // ── Referral leaderboard ──
  const refEl = document.getElementById('adm-referralBoard');
  if (profiles.length === 0) {
    refEl.innerHTML = '<div style="color:var(--muted-2);font-size:13px;">No data yet.</div>';
  } else {
    const refCodeMap = {};
    profiles.forEach(p => {
      const code = btoa(p.id).replace(/=/g, '').substring(0, 12);
      refCodeMap[code] = p;
    });
    const refCounts = {};
    profiles.forEach(p => {
      if (p.referred_by) refCounts[p.referred_by] = (refCounts[p.referred_by] || 0) + 1;
    });
    const top = Object.entries(refCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ profile: refCodeMap[code], count }))
      .filter(x => x.profile);

    if (top.length === 0) {
      refEl.innerHTML = '<div style="color:var(--muted-2);font-size:13px;">No referrals recorded yet.</div>';
    } else {
      function rankBadge(n) {
        if (n >= 50) return '<span class="admin-badge admin-badge-elite">Elite</span>';
        if (n >= 20) return '<span class="admin-badge admin-badge-pro">Pro</span>';
        if (n >= 5)  return '<span class="admin-badge admin-badge-active">Active</span>';
        return '<span class="admin-badge admin-badge-starter">Starter</span>';
      }
      const refRows = top.map((item, i) => `<tr>
        <td class="num" style="color:var(--gold);font-size:13px;">#${i + 1}</td>
        <td>${item.profile.name ? escHtml(item.profile.name) : '—'}</td>
        <td class="num" style="font-size:12px;">${item.profile.email ? escHtml(item.profile.email) : '—'}</td>
        <td style="text-align:center;" class="num">${item.count}</td>
        <td>${rankBadge(item.count)}</td>
      </tr>`).join('');
      refEl.innerHTML = `<div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Name</th><th>Email</th><th style="text-align:center;">Referrals</th><th>Rank</th></tr></thead>
        <tbody>${refRows}</tbody>
      </table></div>`;
    }
  }

  // ── Top Traders (quality score / earners) ──
  const lbData = computeLeaderboardData(profiles, trades);
  state._admLbData = lbData;
  _renderAdminLbTable(lbData, state._admLbMode || 'quality');
}

function _renderAdminActivity(profiles, trades) {
  const signupEl = document.getElementById('adm-recentSignups');
  const tradeEl  = document.getElementById('adm-recentTrades');

  const recentSignups = [...profiles].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  if (recentSignups.length === 0) {
    signupEl.innerHTML = '<div style="color:var(--muted-2);font-size:13px;">None yet.</div>';
  } else {
    signupEl.innerHTML = recentSignups.map(p => `
      <div class="admin-activity-row">
        <span class="admin-activity-time">${fmtDate(new Date(p.created_at).getTime())}</span>
        <span style="flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.email ? escHtml(p.email) : '—'}</span>
        <span class="pill ${p.source === 'signup' ? 'pill-win' : p.source === 'google' ? 'pill-buy' : 'pill-be'}" style="font-size:10px;">${p.source || '—'}</span>
      </div>`).join('');
  }

  const recentTrades = [...trades].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10);
  if (recentTrades.length === 0) {
    tradeEl.innerHTML = '<div style="color:var(--muted-2);font-size:13px;">None yet.</div>';
  } else {
    tradeEl.innerHTML = recentTrades.map(t => `
      <div class="admin-activity-row">
        <span class="admin-activity-time">${fmtDate(new Date(t.created_at).getTime())}</span>
        <span class="pair-cell" style="font-size:12px;width:68px;flex-shrink:0;">${t.pair || '—'}</span>
        ${pillDir(t.direction || 'BUY')}
        ${pillResult(t.result || 'WIN')}
        <span class="num" style="font-size:12px;color:${(Number(t.pnl)||0)>=0?'var(--win)':'var(--loss)'};">${fmtMoney(Number(t.pnl)||0)}</span>
      </div>`).join('');
  }
}

function _renderAdminSystemStats(trades, profiles) {
  function barList(containerId, counts, topN = 7) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const sorted = Object.entries(counts).filter(([k]) => k && k !== 'null' && k !== 'undefined').sort((a, b) => b[1] - a[1]).slice(0, topN);
    if (sorted.length === 0) { el.innerHTML = '<div style="color:var(--muted-2);font-size:13px;">No data.</div>'; return; }
    const max = sorted[0][1];
    el.innerHTML = sorted.map(([label, count]) => `
      <div class="admin-bar-row">
        <span class="admin-bar-label">${escHtml(label)}</span>
        <div class="admin-bar-track"><div class="admin-bar-fill" style="width:${Math.round((count/max)*100)}%"></div></div>
        <span class="admin-bar-count">${count}</span>
      </div>`).join('');
  }

  const pairCounts = {}, emotionCounts = {}, sessionCounts = {}, sourceCounts = {};
  trades.forEach(t => {
    if (t.pair)    pairCounts[t.pair]       = (pairCounts[t.pair]       || 0) + 1;
    if (t.emotions) emotionCounts[t.emotions] = (emotionCounts[t.emotions] || 0) + 1;
    if (t.session)  sessionCounts[t.session]  = (sessionCounts[t.session]  || 0) + 1;
  });
  profiles.forEach(p => {
    const s = p.source || 'unknown';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  });

  barList('adm-statPairs',    pairCounts);
  barList('adm-statEmotions', emotionCounts);
  barList('adm-statSessions', sessionCounts);
  barList('adm-statSources',  sourceCounts);
}

async function adminDeleteUser(userId, displayName) {
  if (!isAdmin()) return;
  if (!confirm('Delete "' + displayName + '" and ALL their trades?\n\nThis cannot be undone.')) return;
  showSpinner('DELETING USER…');
  await _sb.from('trades').delete().eq('user_id', userId);
  await _sb.from('profiles').delete().eq('id', userId);
  hideSpinner();
  toast('User deleted.');
  renderAdmin();
}
