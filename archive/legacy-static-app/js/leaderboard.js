/* ====================================================
   LEADERBOARD
   ==================================================== */
function computeLeaderboardData(profiles, trades) {
  const profileMap = {};
  profiles.forEach(p => { profileMap[p.id] = p; });

  const userStats = {};
  trades.forEach(t => {
    if (!t.user_id) return;
    if (!userStats[t.user_id]) userStats[t.user_id] = { pnl: 0, wins: 0, losses: 0, total: 0, dates: [] };
    userStats[t.user_id].pnl += (Number(t.pnl) || 0);
    userStats[t.user_id].total++;
    if (t.result === 'WIN') userStats[t.user_id].wins++;
    else if (t.result === 'LOSS') userStats[t.user_id].losses++;
    if (t.created_at) userStats[t.user_id].dates.push(new Date(t.created_at));
  });

  const now = Date.now();

  const entries = Object.entries(userStats)
    .filter(([uid]) => profileMap[uid])
    .map(([uid, s]) => {
      const p = profileMap[uid];
      const startBal = p.starting_balance ? Number(p.starting_balance) : null;
      const closed = s.wins + s.losses;
      const winRate = closed > 0 ? (s.wins / closed) * 100 : 0;
      const growthPct = startBal ? (s.pnl / startBal) * 100 : null;
      const qualityScore = (growthPct != null && s.total >= 10 && startBal)
        ? parseFloat((growthPct * (winRate / 100)).toFixed(2))
        : null;

      // Badges
      const badges = [];
      if (winRate >= 60 && s.total >= 20) badges.push('💎');
      // streak badge: count consecutive wins from most recent
      let streak = 0;
      const sorted = [...(trades.filter(t => t.user_id === uid))].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      for (const t of sorted) {
        if (t.result === 'WIN') streak++; else break;
      }
      if (streak >= 5) badges.push('⚡');
      // avg RR badge
      const rrTrades = trades.filter(t => t.user_id === uid && t.rr_ratio);
      const avgRR = rrTrades.length > 0 ? rrTrades.reduce((s, t) => s + Number(t.rr_ratio), 0) / rrTrades.length : 0;
      if (avgRR >= 2.0) badges.push('🎯');
      // active every week for 4 weeks badge
      if (s.dates.length > 0) {
        let activeWeeks = 0;
        for (let w = 0; w < 4; w++) {
          const wEnd = now - w * 7 * 86400000;
          const wStart = wEnd - 7 * 86400000;
          if (s.dates.some(d => d.getTime() >= wStart && d.getTime() < wEnd)) activeWeeks++;
        }
        if (activeWeeks >= 4) badges.push('🔥');
      }
      // warning badge: single loss > 5% of starting balance
      if (startBal) {
        const bigLoss = trades.some(t => t.user_id === uid && t.result === 'LOSS' && Math.abs(Number(t.pnl)) > startBal * 0.05);
        if (bigLoss) badges.push('⚠️');
      }

      return { uid, p, s, startBal, winRate, growthPct, qualityScore, badges, closed };
    });

  return entries;
}

function _badgeTitle(badge) {
  const map = { '💎': 'Elite Win Rate (60%+ over 20 trades)', '⚡': 'Hot Streak (5+ wins in a row)', '🎯': 'Sharp RR (avg 2.0+)', '🔥': 'Consistent (active 4 weeks straight)', '⚠️': 'Risk Warning (single loss >5% of balance)' };
  return map[badge] || '';
}

function renderLeaderboard() {
  const el = document.getElementById('lbContent');
  if (!el) return;
  if (state._lbData) { _renderPublicLbTable(state._lbData, state._lbMode); return; }

  el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">◆</div><div class="empty-state-title">LOADING…</div></div>';

  Promise.all([
    _sb.from('profiles').select('id,name,starting_balance').order('created_at', { ascending: false }),
    _sb.from('trades').select('user_id,pnl,result,rr_ratio,created_at').order('created_at', { ascending: false })
  ]).then(([{ data: profiles }, { data: trades }]) => {
    const p = profiles || [];
    const t = trades || [];
    if (p.length === 0 && t.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏆</div><div class="empty-state-title">NO DATA YET</div><div class="empty-state-sub">Be the first to make the leaderboard</div></div>';
      return;
    }
    state._lbData = computeLeaderboardData(p, t);
    _renderPublicLbTable(state._lbData, state._lbMode);
  });
}

function setLbMode(mode) {
  state._lbMode = mode;
  document.getElementById('lb-btn-quality')?.classList.toggle('active', mode === 'quality');
  document.getElementById('lb-btn-earners')?.classList.toggle('active', mode === 'earners');
  if (state._lbData) _renderPublicLbTable(state._lbData, mode);
}

function _renderPublicLbTable(entries, mode) {
  const el = document.getElementById('lbContent');
  if (!el) return;

  let sorted;
  if (mode === 'earners') {
    sorted = [...entries].filter(e => e.s.total >= 5).sort((a, b) => b.s.pnl - a.s.pnl).slice(0, 20);
  } else {
    sorted = [...entries].filter(e => e.qualityScore != null).sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 20);
  }

  if (sorted.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏆</div><div class="empty-state-title">NOT ENOUGH DATA</div><div class="empty-state-sub">Traders need min 10 trades + starting balance set</div></div>';
    return;
  }

  const firstName = name => name ? name.split(' ')[0] : 'Trader';
  const rankIcon = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  el.innerHTML = sorted.map((e, i) => {
    const scoreDisplay = mode === 'earners'
      ? `<div class="lb-score" style="color:${e.s.pnl >= 0 ? 'var(--win)' : 'var(--loss)'};">${fmtMoney(e.s.pnl)}</div>`
      : `<div class="lb-score">${e.qualityScore > 0 ? '+' : ''}${e.qualityScore}</div>`;
    const metaLine = mode === 'earners'
      ? `${e.s.total} trades &middot; ${Math.round(e.winRate)}% WR`
      : `${e.growthPct != null ? (e.growthPct >= 0 ? '+' : '') + e.growthPct.toFixed(1) + '% growth' : ''} &middot; ${Math.round(e.winRate)}% WR`;
    return `<div class="lb-row">
      <div class="lb-rank">${rankIcon(i)}</div>
      <div class="lb-info">
        <div class="lb-name">${firstName(e.p.name)}</div>
        <div class="lb-meta">${metaLine}</div>
        <div class="lb-badges">${e.badges.map(b => `<span class="lb-badge" title="${_badgeTitle(b)}">${b}</span>`).join('')}</div>
      </div>
      ${scoreDisplay}
    </div>`;
  }).join('');
}

function _renderAdminLbTable(entries, mode) {
  const el = document.getElementById('adm-topTraders');
  if (!el) return;

  // Update button states
  const qBtn = document.getElementById('adm-lb-btn-quality');
  const eBtn = document.getElementById('adm-lb-btn-earners');
  if (qBtn) { qBtn.style.color = mode === 'quality' ? 'var(--gold)' : ''; qBtn.style.borderColor = mode === 'quality' ? 'rgba(212,175,55,0.4)' : ''; }
  if (eBtn) { eBtn.style.color = mode === 'earners' ? 'var(--gold)' : ''; eBtn.style.borderColor = mode === 'earners' ? 'rgba(212,175,55,0.4)' : ''; }

  let sorted;
  if (mode === 'earners') {
    sorted = [...entries].filter(e => e.s.total >= 5).sort((a, b) => b.s.pnl - a.s.pnl).slice(0, 15);
  } else {
    sorted = [...entries].filter(e => e.qualityScore != null).sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 15);
  }

  if (sorted.length === 0) {
    el.innerHTML = '<div style="color:var(--muted-2);font-size:13px;">No qualifying traders yet.</div>';
    return;
  }

  const rankIcon = i => i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;

  const rows = sorted.map((e, i) => {
    const growthCell = e.growthPct != null
      ? `<span style="color:${e.growthPct >= 0 ? 'var(--win)' : 'var(--loss)'}">${e.growthPct >= 0 ? '+' : ''}${e.growthPct.toFixed(1)}%</span>`
      : '<span style="color:var(--muted-2)">—</span>';
    const scoreCell = mode === 'earners'
      ? `<span style="color:${e.s.pnl >= 0 ? 'var(--win)' : 'var(--loss)'};">${fmtMoney(e.s.pnl)}</span>`
      : `<span style="color:var(--gold);">${e.qualityScore != null ? e.qualityScore : '—'}</span>`;
    return `<tr>
      <td class="num" style="color:var(--gold);font-size:13px;">${rankIcon(i)}</td>
      <td>${e.p.name ? escHtml(e.p.name) : '<span style="color:var(--muted-2)">—</span>'}</td>
      <td class="num" style="font-size:12px;">${e.p.email ? escHtml(e.p.email) : '—'}</td>
      <td class="num">${e.s.total}</td>
      <td class="num">${Math.round(e.winRate)}%</td>
      <td class="num">${growthCell}</td>
      <td class="num">${scoreCell}</td>
      <td style="font-size:14px;">${e.badges.join(' ')}</td>
    </tr>`;
  }).join('');

  const scoreHeader = mode === 'earners' ? 'Total PnL' : 'Q-Score';
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Trades</th><th>Win Rate</th><th>Growth</th><th>${scoreHeader}</th><th>Badges</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function setAdminLbMode(mode) {
  state._admLbMode = mode;
  if (state._admLbData) _renderAdminLbTable(state._admLbData, mode);
}
