/* ---------- DASHBOARD ---------- */
let bannerDismissed = {};

function renderDashboard() {
  renderAccountTracker();
  const t = state.trades;
  const total = t.length;
  const wins = t.filter(x => x.result === 'WIN').length;
  const losses = t.filter(x => x.result === 'LOSS').length;
  const totalPnL = t.reduce((s, x) => s + (Number(x.pnl) || 0), 0);
  const closed = wins + losses;
  const winRate = closed === 0 ? null : Math.round((wins / closed) * 100);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statTotalFoot').textContent = total === 0 ? 'No trades yet' : (wins + ' wins / ' + losses + ' losses');
  document.getElementById('statWinRate').textContent = winRate === null ? '—' : winRate + '%';
  document.getElementById('statWinRateFoot').textContent = winRate === null ? 'Log a trade to start' : (winRate >= 50 ? 'Above 50% — solid' : 'Below 50% — tighten up');

  const pnlEl = document.getElementById('statPnL');
  pnlEl.textContent = fmtMoney(totalPnL);
  pnlEl.classList.remove('win', 'loss', 'gold');
  if (totalPnL > 0) pnlEl.classList.add('win');
  else if (totalPnL < 0) pnlEl.classList.add('loss');

  const byPair = {};
  t.forEach(x => { byPair[x.pair] = (byPair[x.pair] || 0) + (Number(x.pnl) || 0); });
  let bestPair = '—', bestPnL = -Infinity;
  for (const [p, v] of Object.entries(byPair)) { if (v > bestPnL) { bestPnL = v; bestPair = p; } }
  document.getElementById('statBestPair').textContent = total === 0 ? '—' : bestPair;
  document.getElementById('statBestPairFoot').textContent = total === 0 ? 'Highest PnL pair' : fmtMoney(bestPnL) + ' on ' + bestPair;

  const rrTrades = t.filter(x => x.rr_ratio !== '' && x.rr_ratio !== null && !isNaN(Number(x.rr_ratio)));
  const avgRR = rrTrades.length === 0 ? null : (rrTrades.reduce((s, x) => s + Number(x.rr_ratio), 0) / rrTrades.length);
  document.getElementById('statAvgRR').textContent = avgRR === null ? '—' : (avgRR >= 0 ? '1:' + avgRR.toFixed(1) : avgRR.toFixed(1));

  const sorted = [...t].sort((a, b) => b.created_at - a.created_at);
  let streak = 0, streakType = null;
  for (const x of sorted) {
    if (x.result === 'BREAKEVEN') continue;
    if (streakType === null) { streakType = x.result; streak = 1; }
    else if (x.result === streakType) streak++;
    else break;
  }
  const streakEl = document.getElementById('statStreak');
  streakEl.classList.remove('win','loss','gold');
  if (streakType === 'WIN') { streakEl.textContent = 'W' + streak; streakEl.classList.add('win'); document.getElementById('statStreakFoot').textContent = streak + ' wins in a row'; }
  else if (streakType === 'LOSS') { streakEl.textContent = 'L' + streak; streakEl.classList.add('loss'); document.getElementById('statStreakFoot').textContent = streak + ' — reset now'; }
  else { streakEl.textContent = '—'; document.getElementById('statStreakFoot').textContent = 'Current run'; }

  document.getElementById('statWins').textContent = wins;
  document.getElementById('statLosses').textContent = losses;

  // Render psychology advisor
  renderPsychAdvisor();

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
          ${recent.map(t => `
            <tr>
              <td class="num text-muted">${fmtDate(t.created_at)}</td>
              <td class="pair-cell">${t.pair}</td>
              <td>${pillDir(t.direction)}</td>
              <td>${pillResult(t.result)}</td>
              <td class="num ${t.pnl > 0 ? 'text-win' : t.pnl < 0 ? 'text-loss' : ''}">${fmtMoney(t.pnl)}</td>
              <td class="num text-muted">${t.rr_ratio || '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderAccountTracker() {
  const el = document.getElementById('accountTracker');
  if (!el) return;

  const profile = state.profile;
  const startBal = (profile?.starting_balance != null && profile.starting_balance !== '') ? Number(profile.starting_balance) : null;
  const dailyLossLimit = (profile?.daily_loss_limit != null && profile.daily_loss_limit !== '') ? Number(profile.daily_loss_limit) : 3;
  const totalPnL = state.trades.reduce((s, x) => s + (Number(x.pnl) || 0), 0);

  if (!startBal) {
    el.innerHTML = `
      <div class="section" style="border-color:rgba(212,175,55,0.25); margin-bottom:16px;">
        <div class="section-title" style="margin-bottom:8px;">ACCOUNT TRACKER</div>
        <div style="font-size:13px; color:var(--muted); margin-bottom:12px;">Set your starting balance to track account growth and daily risk.</div>
        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
          <input type="number" id="quickStartBalance" placeholder="Starting balance ($)" min="0" step="0.01"
            style="flex:1; min-width:160px; background:var(--black-3); border:1px solid var(--gold-dim); color:var(--text); border-radius:8px; padding:10px 12px; font-size:14px; outline:none;">
          <button class="btn btn-primary" onclick="saveStartingBalance()" style="width:auto; padding:10px 20px; font-size:13px;">SAVE</button>
        </div>
      </div>`;
    return;
  }

  const currentBal = startBal + totalPnL;
  const growthPct = (totalPnL / startBal) * 100;

  const today = new Date().toDateString();
  const todayPnL = state.trades
    .filter(x => new Date(x.created_at).toDateString() === today)
    .reduce((s, x) => s + (Number(x.pnl) || 0), 0);

  const dailyLossThreshold = -(startBal * (dailyLossLimit / 100));
  const limitHit = todayPnL <= dailyLossThreshold && todayPnL < 0;

  const alertHtml = limitHit
    ? `<div class="daily-loss-alert">&#x26D4; DAILY LOSS LIMIT HIT — Stop trading for today</div>`
    : (todayPnL < 0 && todayPnL > dailyLossThreshold)
      ? `<div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:10px 14px;font-size:12px;color:var(--muted);">Today P&amp;L: <span style="color:var(--loss);">${fmtMoney(todayPnL)}</span> &nbsp;&middot;&nbsp; Daily limit: <span style="color:var(--loss);">${fmtMoney(dailyLossThreshold)}</span></div>`
      : '';

  const resetHistHtml = state.resets.length > 0 ? `
    <div id="resetHistSection" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--line);">
      <div style="font-size:11px; letter-spacing:0.15em; color:var(--muted); text-transform:uppercase; margin-bottom:8px;">Reset History</div>
      ${state.resets.map(r => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.04); font-size:12px;">
          <span style="color:var(--muted);">${fmtDate(new Date(r.created_at).getTime())}</span>
          <span>${fmtMoney(r.new_balance)}</span>
          ${r.note ? `<span style="color:var(--muted-2); font-size:11px; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(r.note)}</span>` : ''}
        </div>`).join('')}
    </div>` : '';

  el.innerHTML = `
    <div class="section" style="border-color:rgba(212,175,55,0.25); margin-bottom:16px;">
      <div class="row between" style="margin-bottom:12px; align-items:center;">
        <div class="section-title" style="margin-bottom:0;">ACCOUNT TRACKER</div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span style="font-size:11px; color:var(--muted); font-family:'Bebas Neue',sans-serif; letter-spacing:0.08em;">Daily limit: ${dailyLossLimit}%</span>
          <button class="logout-btn" style="font-size:10px; padding:3px 8px; color:var(--gold); border-color:rgba(212,175,55,0.4);" onclick="openResetModal()">RESET</button>
        </div>
      </div>
      <div class="acct-tracker-cards">
        <div class="stat-card">
          <div class="stat-label">Starting Balance</div>
          <div class="stat-value" style="font-size:18px;">${fmtMoney(startBal)}</div>
          <div class="stat-foot">Base capital</div>
        </div>
        <div class="stat-card${currentBal >= startBal ? ' highlight' : ''}">
          <div class="stat-label">Current Balance</div>
          <div class="stat-value ${currentBal >= startBal ? 'gold' : 'loss'}" style="font-size:18px;">${fmtMoney(currentBal)}</div>
          <div class="stat-foot">Start + All PnL</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Growth</div>
          <div class="stat-value ${growthPct >= 0 ? 'win' : 'loss'}" style="font-size:18px;">${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(2)}%</div>
          <div class="stat-foot">Since starting balance</div>
        </div>
      </div>
      ${alertHtml}
      ${resetHistHtml}
      ${state.resets.length > 0 ? `<button onclick="toggleResetHistory()" style="background:none;border:none;color:var(--muted);font-size:11px;letter-spacing:0.1em;cursor:pointer;padding:8px 0 0;text-transform:uppercase;">&#9658; Reset History (${state.resets.length})</button>` : ''}
    </div>`;
}

async function saveStartingBalance() {
  const val = document.getElementById('quickStartBalance')?.value;
  if (!val || isNaN(Number(val)) || Number(val) <= 0) { toast('Enter a valid balance amount.', 'error'); return; }
  showSpinner('SAVING…');
  const { error } = await _sb.from('profiles').upsert({ id: state.user.id, email: state.user.email, starting_balance: Number(val) });
  hideSpinner();
  if (error) { toast('Error saving balance.', 'error'); return; }
  state.profile = { ...state.profile, starting_balance: Number(val) };
  toast('Starting balance saved ✅');
  renderDashboard();
}

/* ====================================================
   PSYCHOLOGY ADVISOR
   ==================================================== */
function renderPsychAdvisor() {
  const el = document.getElementById('psychAdvisor');
  if (!el || state.trades.length < 3) { if(el) el.style.display='none'; return; }
  el.style.display = 'block';

  const insights = [];
  const trades = state.trades;

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
    // Collect all tags and their loss rates
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

    // Worst tag by loss rate (min 2 occurrences)
    const badTags = Object.entries(tagStats)
      .filter(([, v]) => v.total >= 2 && v.losses / v.total > 0.6)
      .sort((a, b) => b[1].losses / b[1].total - a[1].losses / a[1].total);
    if (badTags.length > 0) {
      const [tag, stats] = badTags[0];
      const lossRate = Math.round(stats.losses / stats.total * 100);
      insights.push({ type: 'warning', text: `🏷️ Tag "${tag}" appears on ${stats.total} trades with a ${lossRate}% loss rate. This is a pattern — address it before it compounds.` });
    }

    // Tags with negative total PnL
    const drainTags = Object.entries(tagStats)
      .filter(([, v]) => v.total >= 2 && v.pnl < -50)
      .sort((a, b) => a[1].pnl - b[1].pnl);
    if (drainTags.length > 0) {
      const [tag, stats] = drainTags[0];
      insights.push({ type: 'warning', text: `💸 Trades tagged "${tag}" have cost you ${fmtMoney(Math.abs(stats.pnl))} total. Eliminate this behaviour from your process.` });
    }

    // Best positive tag
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

    // D/C grade trades that lost
    const weakGrades = ['D', 'C'].filter(g => gradeStats[g] && gradeStats[g].total >= 2);
    weakGrades.forEach(g => {
      const s = gradeStats[g];
      const lossRate = Math.round((1 - s.wins / s.total) * 100);
      if (lossRate > 55) {
        insights.push({ type: 'warning', text: `📉 You've taken ${s.total} Grade ${g} setups with a ${lossRate}% loss rate. You know these setups are weak — stop taking them.` });
      }
    });

    // A+ or A grade performance
    const topGrades = ['A+', 'A'].filter(g => gradeStats[g] && gradeStats[g].total >= 2);
    topGrades.forEach(g => {
      const s = gradeStats[g];
      const wr = Math.round(s.wins / s.total * 100);
      if (wr >= 60) {
        insights.push({ type: 'good', text: `🥇 Grade ${g} setups have a ${wr}% win rate across ${s.total} trades and ${fmtMoney(s.pnl)} total PnL. Stack more of these only.` });
      }
    });

    // Grade mismatch insight — B/C/D outperforming A+ in PnL (inconsistency signal)
    if (gradeStats['D'] && gradeStats['A+'] && gradeStats['D'].pnl > gradeStats['A+'].pnl) {
      insights.push({ type: 'warning', text: `⚠️ Your D-grade trades are generating more PnL than A+ trades — check if your grading system reflects your actual edge or if you're undergrading quality setups.` });
    }
  }

  // ── SESSION ANALYSIS ──
  const sessions = ['London','New York','Asian','Overlap'];
  let bestSession = null, bestPnL = -Infinity;
  let worstSession = null, worstPnL = Infinity;
  sessions.forEach(s => {
    const sTrades = trades.filter(t => t.session === s);
    if (sTrades.length < 2) return;
    const sp = sTrades.reduce((sum,t) => sum+(Number(t.pnl)||0), 0);
    if (sp > bestPnL) { bestPnL = sp; bestSession = s; }
    if (sp < worstPnL) { worstPnL = sp; worstSession = s; }
  });
  if (bestSession && bestPnL > 0) {
    insights.push({ type: 'good', text: `💪 Your strongest session is ${bestSession} with ${fmtMoney(bestPnL)} PnL. Prioritise your best setups here.` });
  }
  if (worstSession && worstPnL < -50 && worstSession !== bestSession) {
    insights.push({ type: 'warning', text: `⏰ The ${worstSession} session is costing you ${fmtMoney(Math.abs(worstPnL))}. Consider reducing size or avoiding it entirely.` });
  }

  // ── BEST PAIR ──
  const pairs = [...new Set(trades.map(t => t.pair))];
  let bestPair = null, bestPairPnL = -Infinity;
  pairs.forEach(p => {
    const pp = trades.filter(t => t.pair === p).reduce((sum,t) => sum+(Number(t.pnl)||0), 0);
    if (pp > bestPairPnL) { bestPairPnL = pp; bestPair = p; }
  });
  if (bestPair && bestPairPnL > 0) {
    insights.push({ type: 'good', text: `🎯 Your best pair is ${bestPair} with ${fmtMoney(bestPairPnL)} total PnL. Specialise — master the instrument you print on.` });
  }

  // ── LOSING STREAK ──
  const sorted = [...trades].sort((a,b) => b.created_at - a.created_at);
  let streak = 0, streakType = null;
  for (const t of sorted) {
    if (t.result === 'BREAKEVEN') continue;
    if (!streakType) { streakType = t.result; streak = 1; }
    else if (t.result === streakType) streak++;
    else break;
  }
  if (streakType === 'LOSS' && streak >= 2) {
    insights.push({ type: 'warning', text: `🛑 You're on a ${streak}-trade losing streak. Reduce size to 0.5%, review your last ${streak} charts, and only re-enter on an A-grade setup.` });
  }
  if (streakType === 'WIN' && streak >= 3) {
    insights.push({ type: 'good', text: `🔥 ${streak}-trade winning streak. You're in flow — stay disciplined, don't revenge-size, keep the same process that got you here.` });
  }

  if (insights.length === 0) {
    insights.push({ type: 'good', text: `✅ Your trading looks solid. Keep logging consistently — deeper insights unlock as your data grows.` });
  }

  // Limit to 4 most important insights
  const priority = insights.filter(i => i.type === 'warning').slice(0, 3);
  const good = insights.filter(i => i.type === 'good').slice(0, 1);
  const final = [...priority, ...good];

  el.innerHTML = `
    <div class="psych-card">
      <div class="psych-title">🧠 PSYCHOLOGY ADVISOR</div>
      ${final.map(i => `<div class="psych-insight ${i.type}">${i.text}</div>`).join('')}
    </div>`;
}

function checkSessionBanner() {
  const el = document.getElementById('sessionBanner');
  if (!el) return;

  const now = new Date();
  const utcHour = now.getUTCHours();
  const day = now.getUTCDay(); // 0=Sun, 6=Sat

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

  // Find active session (Overlap takes priority)
  let active = null;
  for (const s of SESSIONS_UTC) {
    const isActive = s.start > s.end
      ? (utcHour >= s.start || utcHour < s.end)   // overnight (Asian)
      : (utcHour >= s.start && utcHour < s.end);
    if (isActive) { active = s; break; }
  }
  // Check Overlap separately (12–16 UTC)
  if (utcHour >= 12 && utcHour < 16) active = SESSIONS_UTC.find(s => s.name === 'Overlap');

  if (!active) { el.style.display = 'none'; return; }

  const key = active.name + '_' + now.toISOString().slice(0, 13); // dismiss per hour
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
