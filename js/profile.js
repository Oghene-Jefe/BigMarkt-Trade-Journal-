/* ====================================================
   PROFILE PAGE
   ==================================================== */
async function renderProfile() {
  if (!state.user) return;
  showSpinner('LOADING PROFILE…');
  const [{ data: profile }, refResult] = await Promise.all([
    _sb.from('profiles').select('*').eq('id', state.user.id).single(),
    (async () => {
      const refCode = btoa(state.user.id).replace(/=/g, '').substring(0, 12);
      return _sb.from('profiles').select('id,created_at').eq('referred_by', refCode);
    })()
  ]);
  hideSpinner();
  const name = profile?.name || state.user.email.split('@')[0];
  const email = state.user.email;
  document.getElementById('avatarInitial').textContent = name.charAt(0).toUpperCase();
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmail').textContent = email;
  document.getElementById('profileBadge').textContent = profile?.source === 'demo' ? 'Demo Trader' : 'FTS Member';
  const savedAvatar = localStorage.getItem('bm_avatar_' + state.user.id);
  if (savedAvatar) {
    document.getElementById('avatarImg').src = savedAvatar;
    document.getElementById('avatarImg').style.display = 'block';
    document.getElementById('avatarInitial').style.display = 'none';
  }
  document.getElementById('editProfileName').value = name;
  if (profile?.timezone) document.getElementById('editProfileTimezone').value = profile.timezone;
  if (profile?.experience) document.getElementById('editProfileExperience').value = profile.experience;
  if (profile?.preferred_pairs) document.getElementById('editProfilePairs').value = profile.preferred_pairs;
  if (profile?.starting_balance != null) document.getElementById('editStartingBalance').value = profile.starting_balance;
  if (profile?.daily_loss_limit != null) document.getElementById('editDailyLossLimit').value = profile.daily_loss_limit;
  else document.getElementById('editDailyLossLimit').value = 3;
  const trades = state.trades;
  const wins = trades.filter(t => t.result === 'WIN').length;
  const losses = trades.filter(t => t.result === 'LOSS').length;
  const total = wins + losses;
  const wr = total ? Math.round(wins / total * 100) : 0;
  const pnl = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  document.getElementById('profileTotalTrades').textContent = trades.length;
  document.getElementById('profileWinRate').textContent = total ? wr + '%' : '—';
  const pnlEl = document.getElementById('profileTotalPnL');
  pnlEl.textContent = fmtMoney(pnl);
  pnlEl.style.color = pnl > 0 ? 'var(--win)' : pnl < 0 ? 'var(--loss)' : 'var(--gold)';

  // Populate referral section inside profile
  const refData = refResult?.data || [];
  const refTotal = refData.length;
  const refCode = btoa(state.user.id).replace(/=/g, '').substring(0, 12);
  const refLink = `https://journal.bigmarkt.co?ref=${refCode}`;

  const linkEl = document.getElementById('referralLinkInput');
  if (linkEl) linkEl.value = refLink;

  const totalEl = document.getElementById('refTotalCount');
  const activeEl = document.getElementById('refActiveCount');
  const rankEl   = document.getElementById('refRank');

  if (totalEl) totalEl.textContent = refTotal;
  if (activeEl) activeEl.textContent = refTotal > 0 ? Math.ceil(refTotal * 0.6) : 0;

  let rank = '—';
  if (refTotal >= 50) rank = '🥇 ELITE';
  else if (refTotal >= 20) rank = '🥈 PRO';
  else if (refTotal >= 5) rank = '🥉 ACTIVE';
  else if (refTotal >= 1) rank = 'STARTER';
  if (rankEl) rankEl.textContent = rank;

  document.getElementById('profileBadge').textContent = profile?.source === 'demo' ? 'Demo Trader' : 'BigMarkt Member';
}

async function saveProfile() {
  const name = document.getElementById('editProfileName').value.trim();
  const timezone = document.getElementById('editProfileTimezone').value;
  const experience = document.getElementById('editProfileExperience').value;
  const preferred_pairs = document.getElementById('editProfilePairs').value.trim();
  const sbVal = document.getElementById('editStartingBalance').value;
  const dllVal = document.getElementById('editDailyLossLimit').value;
  const starting_balance = sbVal !== '' ? Number(sbVal) : null;
  const daily_loss_limit = dllVal !== '' ? Number(dllVal) : 3;
  if (!name) { toast('Enter your name.', 'error'); return; }
  showSpinner('SAVING PROFILE…');
  const { error } = await _sb.from('profiles').upsert({
    id: state.user.id, email: state.user.email,
    name, timezone, experience, preferred_pairs,
    starting_balance, daily_loss_limit
  });
  hideSpinner();
  if (error) { toast('Error saving profile.', 'error'); return; }
  state.profile = { ...state.profile, name, timezone, experience, preferred_pairs, starting_balance, daily_loss_limit };
  document.getElementById('profileName').textContent = name;
  document.getElementById('avatarInitial').textContent = name.charAt(0).toUpperCase();
  toast('Profile saved ✅');
  renderDashboard();
}

async function changePassword() {
  const newPw = document.getElementById('profileNewPw').value;
  const confirmPw = document.getElementById('profileConfirmPw').value;
  if (!newPw || newPw.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
  if (newPw !== confirmPw) { toast('Passwords do not match.', 'error'); return; }
  showSpinner('UPDATING PASSWORD…');
  const { error } = await _sb.auth.updateUser({ password: newPw });
  hideSpinner();
  if (error) { toast('Error: ' + error.message, 'error'); return; }
  document.getElementById('profileNewPw').value = '';
  document.getElementById('profileConfirmPw').value = '';
  toast('Password updated ✅');
}

function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { toast('Image must be under 2MB.', 'error'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    localStorage.setItem('bm_avatar_' + state.user.id, dataUrl);
    document.getElementById('avatarImg').src = dataUrl;
    document.getElementById('avatarImg').style.display = 'block';
    document.getElementById('avatarInitial').style.display = 'none';
    toast('Profile photo updated ✅');
  };
  reader.readAsDataURL(file);
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

/* ====================================================
   REFERRAL SYSTEM
   ==================================================== */
function getReferralLink() {
  if (!state.user) return '';
  const ref = btoa(state.user.id).replace(/=/g, '').substring(0, 12);
  return `https://journal.bigmarkt.co?ref=${ref}`;
}

function copyReferralLink() {
  const link = getReferralLink();
  navigator.clipboard.writeText(link).then(() => {
    toast('Referral link copied! 🔗');
  }).catch(() => {
    document.getElementById('referralLinkInput').select();
    document.execCommand('copy');
    toast('Referral link copied! 🔗');
  });
}

function shareRefToWhatsApp() {
  const link = getReferralLink();
  const msg = `🔥 I'm using BigMarkt Trade Journal to track all my trades — win rate, PnL, calendar heatmap and more. Join me FREE:\n\n${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function shareRefToTelegram() {
  const link = getReferralLink();
  const msg = `🔥 BigMarkt Trade Journal — Free trading journal built for FTS traders. Track every trade, see your edge, fix your leaks. Join FREE: ${link}`;
  window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(msg)}`, '_blank');
}

function shareRefToTwitter() {
  const link = getReferralLink();
  const msg = `Just started tracking every trade on @BigMarkt Trade Journal — free tool built for serious traders. Win rate, PnL curves, psychology insights. Try it: ${link}`;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, '_blank');
}

function shareRefGeneral() {
  const link = getReferralLink();
  if (navigator.share) {
    navigator.share({
      title: 'BigMarkt Trade Journal',
      text: 'Free trading journal built for FTS traders. Track every trade, see your edge.',
      url: link
    });
  } else {
    copyReferralLink();
  }
}

// Check for referral code on load and save it
function checkReferralCode() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref) {
    localStorage.setItem('bm_ref', ref);
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
  }
}
