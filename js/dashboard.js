/* ================================================
   BIGMARKT TRADE JOURNAL — dashboard.js
   Dashboard stats, recent trades, psychology advisor
   ================================================ */

   function renderDashboard() {
    const t      = state.trades;
    const total  = t.length;
    const wins   = t.filter(x => x.result === 'WIN').length;
    const losses = t.filter(x => x.result === 'LOSS').length;
    const totalPnL = t.reduce((s, x) => s + (Number(x.pnl) || 0), 0);
    const closed   = wins + losses;
    const winRate  = closed === 0 ? null : Math.round((wins / closed) * 100);
  
    document.getElementById('statTotal').textContent     = total;
    document.getElementById('statTotalFoot').textContent = total === 0 ? 'No trades yet' : (wins + ' wins / ' + losses + ' losses');
    document.getElementById('statWinRate').textContent   = winRate === null ? '—' : winRate + '%';
    document.getElementById('statWinRateFoot').textContent = winRate === null ? 'Log a trade to start' : (winRate >= 50 ? 'Above 50% — solid' : 'Below 50% — tighten up');
  
    const pnlEl = document.getElementById('statPnL');
    pnlEl.textContent = fmtMoney(totalPnL);
    pnlEl.classList.remove('win', 'loss', 'gold');
    if (totalPnL > 0)      pnlEl.classList.add('win');
    else if (totalPnL < 0) pnlEl.classList.add('loss');
  
    // Best pair
    const byPair = {};
    t.forEach(x => { byPair[x.pair] = (byPair[x.pair] || 0) + (Number(x.pnl) || 0); });
    let bestPair = '—', bestPnL = -Infinity;
    for (const [p, v] of Object.entries(byPair)) {
      if (v > bestPnL) { bestPnL = v; bestPair = p; }
    }
    document.getElementById('statBestPair').textContent     = total === 0 ? '—' : bestPair;
    document.getElementById('statBestPairFoot').textContent = total === 0 ? 'Highest PnL pair' : fmtMoney(bestPnL) + ' on ' + bestPair;
  
    // Avg RR
    const rrTrades = t.filter(x => x.rr_ratio !== '' && x.rr_ratio !== null && !isNaN(Number(x.rr_ratio)));
    const avgRR    = rrTrades.length === 0 ? null : (rrTrades.reduce((s, x) => s + Number(x.rr_ratio), 0) / rrTrades.length);
    document.getElementById('statAvgRR').textContent = avgRR === null ? '—' : (avgRR >= 0 ? '1:' + avgRR.toFixed(1) : avgRR.toFixed(1));
  
    // Win/Loss streak
    const sorted = [...t].sort((a, b) => b.created_at - a.created_at);
    let streak = 0, streakType = null;
    for (const x of sorted) {
      if (x.result === 'BREAKEVEN') continue;
      if (streakType === null)          { streakType = x.result; streak = 1; }
      else if (x.result === streakType) streak++;
      else break;
    }
    const streakEl = document.getElementById('statStreak');
    streakEl.classList.remove('win', 'loss', 'gold');
    if (streakType === 'WIN') {
      streakEl.textContent = 'W' + streak;
      streakEl.classList.add('win');
      document.getElementById('statStreakFoot').textContent = streak + ' wins in a row';
    } else if (streakType === 'LOSS') {
      streakEl.textContent = 'L' + streak;
      streakEl.classList.add('loss');
      document.getElementById('statStreakFoot').textContent = streak + ' — reset now';
    } else {
      streakEl.textContent = '—';
      document.getElementById('statStreakFoot').textContent = 'Current run';
    }
  
    document.getElementById('statWins').textContent   = wins;
    document.getElementById('statLosses').textContent = losses;
  
    // Psychology advisor
    renderPsychAdvisor();
  
    // Recent trades table
    const recent = sorted.slice(0, 5);
    const c = document.getElementById('recentTradesContainer');
    if (recent.length === 0) {
      c.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◆</div>
          <div class="empty-state-title">YOUR JOURNAL IS CLEAN</div>
          <div class="text-muted small">Every elite trader started here. Tap the gold + button to log your first trade.</div>
        </div>`;
      return;
    }
    c.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Date</th><th>Pair</th><th>Dir</th><th>Result</th><th>PnL</th><th>RR</th></tr></thead>
          <tbody>
            ${recent.map(tr => `
              <tr>
                <td class="num text-muted">${fmtDate(tr.created_at)}</td>
                <td class="pair-cell">${tr.pair}</td>
                <td>${pillDir(tr.direction)}</td>
                <td>${pillResult(tr.result)}</td>
                <td class="num ${tr.pnl > 0 ? 'text-win' : tr.pnl < 0 ? 'text-loss' : ''}">${fmtMoney(tr.pnl)}</td>
                <td class="num text-muted">${tr.rr_ratio || '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }
  
  /* ================================================
     PSYCHOLOGY ADVISOR
     Analyses emotions, tags, grades, sessions, pairs
     ================================================ */
  function renderPsychAdvisor() {
    const el = document.getElementById('psychAdvisor');
    if (!el || state.trades.length < 3) { if (el) el.style.display = 'none'; return; }
    el.style.display = 'block';
  
    const insights = [];
    const trades   = state.trades;
  
    // ── EMOTION ANALYSIS ──
    const fomoTrades  = trades.filter(t => t.emotions === 'FOMO');
    const fomoLosses  = fomoTrades.filter(t => t.result === 'LOSS').length;
    if (fomoTrades.length >= 2 && fomoLosses / fomoTrades.length > 0.5) {
      insights.push({ type: 'warning', text: `⚠️ FOMO is costing you — ${fomoLosses} of ${fomoTrades.length} FOMO trades were losses. Wait for confirmation before entering.` });
    }
  
    const revengeTrades = trades.filter(t => t.emotions === 'Revenge');
    if (revengeTrades.length >= 1) {
      const revLoss = revengeTrades.filter(t => t.result === 'LOSS').length;
      insights.push({ type: 'warning', text: `🚨 Revenge trading detected — ${revengeTrades.length} revenge trade(s), ${revLoss} ended in losses. Step away after a loss before re-entering.` });
    }
  
    // ── TAG ANALYSIS ──
    const taggedTrades = trades.filter(t => t.tags);
    if (taggedTrades.length >= 2) {
      const tagStats = {};
      taggedTrades.forEach(t => {
        (t.tags || '').split(',').forEach(tag => {
          tag = tag.trim();
          if (!tag) return;
          if (!tagStats[tag]) tagStats[tag] = { total: 0, losses: 0, pnl: 0 };
          tagStats[tag].total++;
          if (t.result === 'LOSS') tagStats[tag].losses++;
          tagStats[tag].pnl += Number(t.pnl) || 0;
        });
      });
  
      const badTags = Object.entries(tagStats)
        .filter(([, v]) => v.total >= 2 && v.losses / v.total > 0.6)
        .sort((a, b) => b[1].losses / b[1].total - a[1].losses / a[1].total);
      if (badTags.length > 0) {
        const [tag, stats] = badTags[0];
        const lossRate = Math.round(stats.losses / stats.total * 100);
        insights.push({ type: 'warning', text: `🏷️ Tag "${tag}" appears on ${stats.total} trades with a ${lossRate}% loss rate. This is a pattern — address it before it compounds.` });
      }
  
      const drainTags = Object.entries(tagStats)
        .filter(([, v]) => v.total >= 2 && v.pnl < -50)
        .sort((a, b) => a[1].pnl - b[1].pnl);
      if (drainTags.length > 0) {
        const [tag, stats] = drainTags[0];
        insights.push({ type: 'warning', text: `💸 Trades tagged "${tag}" have cost you ${fmtMoney(Math.abs(stats.pnl))} total. Eliminate this behaviour from your process.` });
      }
  
      const goodTags = Object.entries(tagStats)
        .filter(([, v]) => v.total >= 2 && v.pnl > 0)
        .sort((a, b) => b[1].pnl - a[1].pnl);
      if (goodTags.length > 0) {
        const [tag, stats] = goodTags[0];
        insights.push({ type: 'good', text: `✅ Trades tagged "${tag}" generated ${fmtMoney(stats.pnl)} total. Keep doing what that tag represents.` });
      }
    }
  
    // ── SETUP GRADE ANALYSIS ──
    const gradedTrades = trades.filter(t => t.setup_grade);
    if (gradedTrades.length >= 3) {
      const gradeStats = {};
      gradedTrades.forEach(t => {
        if (!gradeStats[t.setup_grade]) gradeStats[t.setup_grade] = { total: 0, wins: 0, pnl: 0 };
        gradeStats[t.setup_grade].total++;
        if (t.result === 'WIN') gradeStats[t.setup_grade].wins++;
        gradeStats[t.setup_grade].pnl += Number(t.pnl) || 0;
      });
  
      ['D', 'C'].filter(g => gradeStats[g] && gradeStats[g].total >= 2).forEach(g => {
        const s        = gradeStats[g];
        const lossRate = Math.round((1 - s.wins / s.total) * 100);
        if (lossRate > 55) {
          insights.push({ type: 'warning', text: `📉 You've taken ${s.total} Grade ${g} setups with a ${lossRate}% loss rate. You know these are weak — stop taking them.` });
        }
      });
  
      ['A+', 'A'].filter(g => gradeStats[g] && gradeStats[g].total >= 2).forEach(g => {
        const s  = gradeStats[g];
        const wr = Math.round(s.wins / s.total * 100);
        if (wr >= 60) {
          insights.push({ type: 'good', text: `🥇 Grade ${g} setups: ${wr}% win rate across ${s.total} trades, ${fmtMoney(s.pnl)} total PnL. Stack more of these only.` });
        }
      });
  
      if (gradeStats['D'] && gradeStats['A+'] && gradeStats['D'].pnl > gradeStats['A+'].pnl) {
        insights.push({ type: 'warning', text: `⚠️ D-grade trades are outperforming A+ trades — revisit your grading system or you may be undergrading quality setups.` });
      }
    }
  
    // ── SESSION ANALYSIS ──
    let bestSession = null, bestSessionPnL = -Infinity;
    let worstSession = null, worstSessionPnL = Infinity;
    ['London', 'New York', 'Asian', 'Overlap'].forEach(s => {
      const sTrades = trades.filter(t => t.session === s);
      if (sTrades.length < 2) return;
      const sp = sTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
      if (sp > bestSessionPnL)  { bestSessionPnL  = sp; bestSession  = s; }
      if (sp < worstSessionPnL) { worstSessionPnL = sp; worstSession = s; }
    });
    if (bestSession && bestSessionPnL > 0) {
      insights.push({ type: 'good', text: `💪 Strongest session: ${bestSession} with ${fmtMoney(bestSessionPnL)} PnL. Prioritise your best setups here.` });
    }
    if (worstSession && worstSessionPnL < -50 && worstSession !== bestSession) {
      insights.push({ type: 'warning', text: `⏰ ${worstSession} session is costing you ${fmtMoney(Math.abs(worstSessionPnL))}. Consider reducing size or avoiding it entirely.` });
    }
  
    // ── BEST PAIR ──
    const pairMap = {};
    trades.forEach(t => { pairMap[t.pair] = (pairMap[t.pair] || 0) + (Number(t.pnl) || 0); });
    const bestPairEntry = Object.entries(pairMap).sort((a, b) => b[1] - a[1])[0];
    if (bestPairEntry && bestPairEntry[1] > 0) {
      insights.push({ type: 'good', text: `🎯 Best pair: ${bestPairEntry[0]} with ${fmtMoney(bestPairEntry[1])} total PnL. Specialise — master the instrument you print on.` });
    }
  
    // ── LOSING / WINNING STREAK ──
    const sorted = [...trades].sort((a, b) => b.created_at - a.created_at);
    let streak = 0, streakType = null;
    for (const t of sorted) {
      if (t.result === 'BREAKEVEN') continue;
      if (!streakType)               { streakType = t.result; streak = 1; }
      else if (t.result === streakType) streak++;
      else break;
    }
    if (streakType === 'LOSS' && streak >= 2) {
      insights.push({ type: 'warning', text: `🛑 ${streak}-trade losing streak. Cut size to 0.5%, review your last ${streak} charts, re-enter only on an A-grade setup.` });
    }
    if (streakType === 'WIN' && streak >= 3) {
      insights.push({ type: 'good', text: `🔥 ${streak}-trade winning streak. Stay disciplined — same process, same size. Don't let confidence become overconfidence.` });
    }
  
    if (insights.length === 0) {
      insights.push({ type: 'good', text: `✅ Solid so far. Keep logging consistently — deeper insights unlock as your data grows.` });
    }
  
    // Show max 3 warnings + 1 positive
    const warnings  = insights.filter(i => i.type === 'warning').slice(0, 3);
    const positives = insights.filter(i => i.type === 'good').slice(0, 1);
    const final     = [...warnings, ...positives];
  
    el.innerHTML = `
      <div class="psych-card">
        <div class="psych-title">🧠 PSYCHOLOGY ADVISOR</div>
        ${final.map(i => `<div class="psych-insight ${i.type}">${i.text}</div>`).join('')}
      </div>`;
  }
  
  /* ================================================
     SESSION BANNER
     In-app only — no push notifications
     ================================================ */
  const SESSIONS_UTC = [
    { name: 'Asian',    start: 23, end: 8,  emoji: '🌏', msg: 'Asian Session is LIVE — Tokyo & Sydney markets are open.' },
    { name: 'London',   start: 7,  end: 16, emoji: '🏦', msg: 'London Session is LIVE — highest liquidity window is open.' },
    { name: 'New York', start: 12, end: 21, emoji: '🗽', msg: 'New York Session is LIVE — NY open, big moves possible.' },
    { name: 'Overlap',  start: 12, end: 16, emoji: '⚡', msg: 'London–NY Overlap is LIVE — the sharpest moves happen now.' },
  ];
  
  let bannerDismissed = {};
  
  function checkSessionBanner() {
    const el = document.getElementById('sessionBanner');
    if (!el) return;
  
    const now     = new Date();
    const utcHour = now.getUTCHours();
    const day     = now.getUTCDay(); // 0=Sun, 6=Sat
  
    // Weekend banner
    if (day === 0 || day === 6) {
      const key = 'weekend_' + now.toISOString().slice(0, 10);
      if (bannerDismissed[key]) { el.style.display = 'none'; return; }
      el.innerHTML = `
        <div class="session-banner weekend">
          <div class="session-banner-text">
            <strong>📅 MARKETS ARE CLOSED</strong><br>
            Weekend — perfect time for your weekly review. Check your Reports tab in the Log page.
          </div>
          <button class="session-banner-close" onclick="dismissBanner('${key}')">✕</button>
        </div>`;
      el.style.display = 'block';
      return;
    }
  
    // Overlap takes priority (12–16 UTC)
    let active = utcHour >= 12 && utcHour < 16
      ? SESSIONS_UTC.find(s => s.name === 'Overlap')
      : null;
  
    if (!active) {
      for (const s of SESSIONS_UTC.filter(s => s.name !== 'Overlap')) {
        const isActive = s.start > s.end
          ? (utcHour >= s.start || utcHour < s.end)
          : (utcHour >= s.start && utcHour < s.end);
        if (isActive) { active = s; break; }
      }
    }
  
    if (!active) { el.style.display = 'none'; return; }
  
    const key = active.name + '_' + now.toISOString().slice(0, 13);
    if (bannerDismissed[key]) { el.style.display = 'none'; return; }
  
    el.innerHTML = `
      <div class="session-banner">
        <div class="session-banner-text">
          <strong>${active.emoji} ${active.name.toUpperCase()} SESSION</strong><br>
          ${active.msg}
        </div>
        <button class="session-banner-close" onclick="dismissBanner('${key}')">✕</button>
      </div>`;
    el.style.display = 'block';
  }
  
  function dismissBanner(key) {
    bannerDismissed[key] = true;
    const el = document.getElementById('sessionBanner');
    if (el) el.style.display = 'none';
  }