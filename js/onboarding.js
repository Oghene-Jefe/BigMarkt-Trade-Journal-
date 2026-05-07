/* ====================================================
   ONBOARDING
   ==================================================== */
function maybeShowOnboarding() {
  if (!state.user) return;
  const skippedKey = 'bm_ob_done_' + state.user.id;
  if (localStorage.getItem(skippedKey)) return;
  if (state.profile?.starting_balance) { localStorage.setItem(skippedKey, '1'); return; }
  showOnboarding();
}

function showOnboarding() {
  const name = state.profile?.name || state.user?.email?.split('@')[0] || 'Trader';
  document.getElementById('ob-welcome-msg').textContent =
    'Welcome to BigMarkt Trade Journal, ' + name + '. Let\'s set up your account in 3 quick steps.';
  switchOnboardingStep(0);
  document.getElementById('onboardingOverlay').classList.add('show');
}

function switchOnboardingStep(step) {
  [0, 1, 2, 3].forEach(i => {
    const panel = document.getElementById('ob-step-' + i);
    const dot   = document.getElementById('ob-dot-' + i);
    if (panel) panel.style.display = i === step ? '' : 'none';
    if (dot)   dot.classList.toggle('active', i === step);
  });
}

async function finishOnboarding() {
  const balVal      = document.getElementById('obBalance').value;
  const timezoneVal = document.getElementById('obTimezone').value;
  const pairsVal    = document.getElementById('obPairs').value.trim();
  const starting_balance = balVal !== '' && !isNaN(Number(balVal)) && Number(balVal) > 0 ? Number(balVal) : null;
  const update = { id: state.user.id, email: state.user.email };
  if (starting_balance) update.starting_balance = starting_balance;
  if (timezoneVal) update.timezone = timezoneVal;
  if (pairsVal)    update.preferred_pairs = pairsVal;
  if (starting_balance || timezoneVal || pairsVal) {
    showSpinner('SAVING…');
    await _sb.from('profiles').upsert(update);
    hideSpinner();
    state.profile = { ...state.profile, ...update };
  }
  localStorage.setItem('bm_ob_done_' + state.user.id, '1');
  document.getElementById('onboardingOverlay').classList.remove('show');
  if (starting_balance) toast('Account set up. Start logging your trades!');
  renderDashboard();
}

function skipOnboarding() {
  localStorage.setItem('bm_ob_done_' + state.user.id, '1');
  document.getElementById('onboardingOverlay').classList.remove('show');
}
