/* ============================================================
   30-DAY TRADING CHALLENGE
   ============================================================ */

let _selectedGoalType = 'win_rate'; // tracks UI selection before starting

/* ── Data layer ─────────────────────────────────────────────── */

async function loadChallenge() {
  if (!state.user) return null;
  const { data, error } = await _sb
    .from('challenges')
    .select('*')
    .eq('user_id', state.user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('loadChallenge error:', error); return null; }
  state.challenge = data || null;
  renderChallengeCard();
  return state.challenge;
}

async function startChallenge(goalType, goalTarget) {
  if (!state.user) return;
  if (state.challenge) { toast('You already have an active challenge.', 'error'); return; }

  const target = Number(goalTarget);
  if (!goalType || isNaN(target) || target <= 0) {
    toast('Set a valid goal type and target.', 'error'); return;
  }

  const today     = new Date();
  const startDate = today.toISOString().slice(0, 10);
  const endDate   = new Date(today.getTime() + 30 * 864e5).toISOString().slice(0, 10);

  showSpinner('STARTING CHALLENGE…');
  const { data, error } = await _sb.from('challenges').insert({
    user_id:        state.user.id,
    start_date:     startDate,
    end_date:       endDate,
    goal_type:      goalType,
    goal_target:    target,
    status:         'active',
    current_streak: 0,
    longest_streak: 0,
  }).select().single();
  hideSpinner();

  if (error) { toast('Could not start challenge. Try again.', 'error'); console.error(error); return; }
  state.challenge = data;
  toast("30-Day Challenge started! Let's go 🔥");
  renderChallengeCard();
}

async function abandonChallenge() {
  if (!state.challenge) return;
  const ok = confirm('Abandon this challenge? This cannot be undone.');
  if (!ok) return;

  const { error } = await _sb.from('challenges')
    .update({ status: 'abandoned' })
    .eq('id', state.challenge.id);
  if (error) { toast('Error abandoning challenge.', 'error'); return; }
  state.challenge = null;
  toast('Challenge abandoned.');
  renderChallengeCard();
}

async function completeChallenge(badge) {
  if (!state.challenge) return;
  const update = {
    status:       'completed',
    completed_at: new Date().toISOString(),
    badge_earned: badge || null,
  };
  const { error } = await _sb.from('challenges')
    .update(update)
    .eq('id', state.challenge.id);
  if (error) { console.error('completeChallenge error:', error); return; }

  state.challenge = { ...state.challenge, ...update };

  const msgs = {
    gold:   '🥇 GOLD BADGE — Challenge crushed!',
    silver: '🥈 SILVER BADGE — Challenge complete!',
    bronze: '🥉 BRONZE BADGE — Solid effort!',
  };
  toast(badge ? msgs[badge] : 'Challenge complete. Keep pushing.');
  renderChallengeCard();
}

/* ── Progress calculation ─────────────────────────────────── */

async function checkChallengeProgress() {
  const ch = state.challenge;
  if (!ch || ch.status !== 'active') return;

  const start = new Date(ch.start_date + 'T00:00:00');
  const end   = new Date(ch.end_date   + 'T23:59:59');
  const today = new Date();

  // Trades within the challenge window
  const chTrades = state.trades.filter(t => {
    const d = new Date(t.created_at);
    return d >= start && d <= end;
  });

  // Streak — loop backwards through days from today to challenge start
  const cap        = today < end ? today : end;
  const tradedDays = new Set(chTrades.map(t => new Date(t.created_at).toDateString()));
  const days       = [];
  const cursor     = new Date(start);
  while (cursor <= cap) { days.push(cursor.toDateString()); cursor.setDate(cursor.getDate() + 1); }

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (tradedDays.has(days[i])) currentStreak++;
    else break;
  }
  const longestStreak = Math.max(currentStreak, ch.longest_streak || 0);

  // Check if challenge period is complete
  const challengeComplete = new Date(ch.end_date + 'T23:59:59') <= today;

  if (challengeComplete) {
    const current = _calcMetric(chTrades, ch.goal_type);
    const target  = Number(ch.goal_target);
    let badge = null;
    if (current >= target * 1.2)     badge = 'gold';
    else if (current >= target)      badge = 'silver';
    else if (current >= target * 0.7) badge = 'bronze';
    await completeChallenge(badge);
    return;
  }

  // Persist streak if changed
  if (currentStreak !== ch.current_streak || longestStreak !== ch.longest_streak) {
    const { error } = await _sb.from('challenges').update({
      current_streak: currentStreak,
      longest_streak: longestStreak,
    }).eq('id', ch.id);
    if (!error) state.challenge = { ...ch, current_streak: currentStreak, longest_streak: longestStreak };
  }

  renderChallengeCard();
}

/* ── Render ─────────────────────────────────────────────────── */

function renderChallengeCard() {
  const el = document.getElementById('challengeCard');
  if (!el) return;

  const ch = state.challenge;

  /* STATE 1 — no active challenge */
  if (!ch || ch.status === 'abandoned') {
    el.innerHTML = `
      <div class="challenge-title">30-DAY CHALLENGE</div>
      <div class="challenge-subtitle">Pick your goal. Start your run.</div>
      <div class="challenge-goal-btns">
        <button class="challenge-goal-btn${_selectedGoalType === 'win_rate'    ? ' active' : ''}" onclick="selectChallengeGoal('win_rate')">WIN RATE</button>
        <button class="challenge-goal-btn${_selectedGoalType === 'pnl'         ? ' active' : ''}" onclick="selectChallengeGoal('pnl')">PnL TARGET</button>
        <button class="challenge-goal-btn${_selectedGoalType === 'consistency' ? ' active' : ''}" onclick="selectChallengeGoal('consistency')">CONSISTENCY</button>
      </div>
      <input type="number" id="challengeTargetInput" min="1"
        placeholder="${_goalPlaceholder(_selectedGoalType)}"
        style="width:100%;box-sizing:border-box;background:var(--black-3);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:10px 12px;font-size:14px;outline:none;margin-bottom:12px;">
      <button class="btn btn-primary" onclick="submitStartChallenge()" style="margin-bottom:8px;">
        START CHALLENGE
      </button>
      <div style="font-size:11px;color:var(--muted);text-align:center;line-height:1.6;">
        30 days from today. Missing a day breaks your streak.
      </div>`;
    return;
  }

  /* STATE 3 — completed challenge */
  if (ch.status === 'completed') {
    const badgeEmoji = { gold: '🥇', silver: '🥈', bronze: '🥉' }[ch.badge_earned] || '⭐';
    const chTrades = state.trades.filter(t => {
      const d = new Date(t.created_at);
      return d >= new Date(ch.start_date + 'T00:00:00') && d <= new Date(ch.end_date + 'T23:59:59');
    });
    const tradingDays  = new Set(chTrades.map(t => new Date(t.created_at).toDateString())).size;
    const finalMetric  = _calcMetric(chTrades, ch.goal_type);

    el.innerHTML = `
      <div class="challenge-badge">
        <span class="challenge-badge-emoji">${badgeEmoji}</span>
        <div class="challenge-complete-title">CHALLENGE COMPLETE</div>
        <div class="challenge-subtitle">${_goalLabel(ch.goal_type)} GOAL · Target: ${_fmtMetric(ch.goal_type, Number(ch.goal_target))}</div>
        <div class="challenge-pills" style="max-width:340px;margin:16px auto;">
          <div class="challenge-pill">
            <div class="challenge-pill-label">Days Traded</div>
            <div class="challenge-pill-value">${tradingDays}</div>
          </div>
          <div class="challenge-pill">
            <div class="challenge-pill-label">Final ${_goalLabel(ch.goal_type)}</div>
            <div class="challenge-pill-value">${_fmtMetric(ch.goal_type, finalMetric)}</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="resetAndStartNew()" style="margin-top:4px;">
          START NEW CHALLENGE
        </button>
      </div>`;
    return;
  }

  /* STATE 2 — active challenge */
  const start    = new Date(ch.start_date + 'T00:00:00');
  const end      = new Date(ch.end_date   + 'T23:59:59');
  const today    = new Date();
  const dayNum   = Math.min(30, Math.max(1, Math.floor((today - start) / 864e5) + 1));
  const daysLeft = Math.max(0, Math.ceil((end - today) / 864e5));
  const pct      = Math.min(100, Math.round((dayNum / 30) * 100));

  const chTrades      = state.trades.filter(t => {
    const d = new Date(t.created_at);
    return d >= start && d <= end;
  });
  const currentMetric = _calcMetric(chTrades, ch.goal_type);
  const target        = Number(ch.goal_target);
  const streak        = ch.current_streak || 0;
  const bestStreak    = ch.longest_streak || 0;

  let statusClass, statusLabel;
  if (currentMetric >= target * 0.7) {
    statusClass = 'on-track'; statusLabel = 'ON TRACK';
  } else if (daysLeft < 10 && currentMetric < target * 0.5) {
    statusClass = 'at-risk'; statusLabel = 'AT RISK';
  } else {
    statusClass = 'behind'; statusLabel = 'BEHIND';
  }

  el.innerHTML = `
    <div class="challenge-title">30-DAY CHALLENGE — DAY ${dayNum} OF 30</div>
    <div class="challenge-subtitle">${_goalLabel(ch.goal_type)} GOAL: ${_fmtMetric(ch.goal_type, target)}</div>
    <div class="challenge-progress-bar">
      <div class="challenge-progress-fill" style="width:${pct}%"></div>
    </div>
    <div class="challenge-pills">
      <div class="challenge-pill">
        <div class="challenge-pill-label">Streak</div>
        <div class="challenge-pill-value">${streak}</div>
      </div>
      <div class="challenge-pill">
        <div class="challenge-pill-label">Best Streak</div>
        <div class="challenge-pill-value">${bestStreak}</div>
      </div>
      <div class="challenge-pill">
        <div class="challenge-pill-label">Current</div>
        <div class="challenge-pill-value">${_fmtMetric(ch.goal_type, currentMetric)}</div>
      </div>
      <div class="challenge-pill">
        <div class="challenge-pill-label">Goal</div>
        <div class="challenge-pill-value">${_fmtMetric(ch.goal_type, target)}</div>
      </div>
    </div>
    <span class="challenge-status ${statusClass}">${statusLabel}</span>
    <div style="font-size:12px;color:var(--muted);margin:4px 0 8px;">
      ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left
    </div>
    <button class="challenge-abandon" onclick="abandonChallenge()">Abandon challenge</button>`;
}

/* ── UI helpers ─────────────────────────────────────────────── */

function selectChallengeGoal(type) {
  _selectedGoalType = type;
  document.querySelectorAll('.challenge-goal-btn').forEach((b, i) => {
    const types = ['win_rate', 'pnl', 'consistency'];
    b.classList.toggle('active', types[i] === type);
  });
  const input = document.getElementById('challengeTargetInput');
  if (input) input.placeholder = _goalPlaceholder(type);
}

function submitStartChallenge() {
  const input = document.getElementById('challengeTargetInput');
  const val   = input ? Number(input.value.trim()) : 0;
  if (!val || val <= 0) { toast('Enter a valid target value.', 'error'); return; }
  startChallenge(_selectedGoalType, val);
}

function resetAndStartNew() {
  state.challenge    = null;
  _selectedGoalType  = 'win_rate';
  renderChallengeCard();
}

/* ── Pure helpers ───────────────────────────────────────────── */

function _goalPlaceholder(type) {
  return { win_rate: 'Target % e.g. 70', pnl: 'Target $ e.g. 500', consistency: 'Trading days e.g. 20' }[type] || '';
}

function _goalLabel(type) {
  return { win_rate: 'WIN RATE', pnl: 'PNL', consistency: 'CONSISTENCY' }[type] || type.toUpperCase();
}

function _fmtMetric(type, value) {
  if (type === 'win_rate')    return Math.round(value) + '%';
  if (type === 'pnl')         return fmtMoney(value);
  if (type === 'consistency') return value + ' days';
  return String(value);
}

function _calcMetric(trades, goalType) {
  if (goalType === 'win_rate') {
    const wins   = trades.filter(t => t.result === 'WIN').length;
    const losses = trades.filter(t => t.result === 'LOSS').length;
    const closed = wins + losses;
    return closed === 0 ? 0 : (wins / closed) * 100;
  }
  if (goalType === 'pnl')         return trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  if (goalType === 'consistency') return new Set(trades.map(t => new Date(t.created_at).toDateString())).size;
  return 0;
}

/* ── Global assignments (called from inline onclick) ─────────── */
window.abandonChallenge    = abandonChallenge;
window.selectChallengeGoal = selectChallengeGoal;
window.submitStartChallenge = submitStartChallenge;
window.resetAndStartNew    = resetAndStartNew;
