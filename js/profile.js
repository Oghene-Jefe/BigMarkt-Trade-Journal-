/* ================================================
   BIGMARKT TRADE JOURNAL — profile.js
   Profile page, settings, password change, avatar
   ================================================ */

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
  
    const name  = profile?.name || state.user.email.split('@')[0];
    const email = state.user.email;
  
    // Avatar
    document.getElementById('avatarInitial').textContent = name.charAt(0).toUpperCase();
    document.getElementById('profileName').textContent   = name;
    document.getElementById('profileEmail').textContent  = email;
    document.getElementById('profileBadge').textContent  =
      profile?.source === 'demo' ? 'Demo Trader' : 'BigMarkt Member';
  
    const savedAvatar = localStorage.getItem('bm_avatar_' + state.user.id);
    if (savedAvatar) {
      document.getElementById('avatarImg').src            = savedAvatar;
      document.getElementById('avatarImg').style.display  = 'block';
      document.getElementById('avatarInitial').style.display = 'none';
    }
  
    // Form fields
    document.getElementById('editProfileName').value = name;
    if (profile?.timezone)        document.getElementById('editProfileTimezone').value   = profile.timezone;
    if (profile?.experience)      document.getElementById('editProfileExperience').value = profile.experience;
    if (profile?.preferred_pairs) document.getElementById('editProfilePairs').value      = profile.preferred_pairs;
  
    // Stats
    const trades = state.trades;
    const wins   = trades.filter(t => t.result === 'WIN').length;
    const losses = trades.filter(t => t.result === 'LOSS').length;
    const total  = wins + losses;
    const wr     = total ? Math.round(wins / total * 100) : 0;
    const pnl    = trades.reduce((s, t) => s + (Number(t.pnl) || 0), 0);
  
    document.getElementById('profileTotalTrades').textContent = trades.length;
    document.getElementById('profileWinRate').textContent     = total ? wr + '%' : '—';
    const pnlEl = document.getElementById('profileTotalPnL');
    pnlEl.textContent = fmtMoney(pnl);
    pnlEl.style.color = pnl > 0 ? 'var(--win)' : pnl < 0 ? 'var(--loss)' : 'var(--gold)';
  
    // Referral section
    const refData  = refResult?.data || [];
    const refTotal = refData.length;
    const refCode  = btoa(state.user.id).replace(/=/g, '').substring(0, 12);
    const refLink  = `https://journal.bigmarkt.co?ref=${refCode}`;
  
    const linkEl   = document.getElementById('referralLinkInput');
    const totalEl  = document.getElementById('refTotalCount');
    const activeEl = document.getElementById('refActiveCount');
    const rankEl   = document.getElementById('refRank');
  
    if (linkEl)   linkEl.value          = refLink;
    if (totalEl)  totalEl.textContent   = refTotal;
    if (activeEl) activeEl.textContent  = refTotal > 0 ? Math.ceil(refTotal * 0.6) : 0;
  
    let rank = '—';
    if      (refTotal >= 50) rank = '🥇 ELITE';
    else if (refTotal >= 20) rank = '🥈 PRO';
    else if (refTotal >= 5)  rank = '🥉 ACTIVE';
    else if (refTotal >= 1)  rank = 'STARTER';
    if (rankEl) rankEl.textContent = rank;
  }
  
  async function saveProfile() {
    const name            = document.getElementById('editProfileName').value.trim();
    const timezone        = document.getElementById('editProfileTimezone').value;
    const experience      = document.getElementById('editProfileExperience').value;
    const preferred_pairs = document.getElementById('editProfilePairs').value.trim();
    if (!name) { toast('Enter your name.', 'error'); return; }
  
    showSpinner('SAVING PROFILE…');
    const { error } = await _sb.from('profiles').upsert({
      id: state.user.id, email: state.user.email,
      name, timezone, experience, preferred_pairs
    });
    hideSpinner();
    if (error) { toast('Error saving profile.', 'error'); return; }
  
    document.getElementById('profileName').textContent         = name;
    document.getElementById('avatarInitial').textContent       = name.charAt(0).toUpperCase();
    toast('Profile saved ✅');
  }
  
  async function changePassword() {
    const newPw     = document.getElementById('profileNewPw').value;
    const confirmPw = document.getElementById('profileConfirmPw').value;
    if (!newPw || newPw.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
    if (newPw !== confirmPw)        { toast('Passwords do not match.', 'error'); return; }
  
    showSpinner('UPDATING PASSWORD…');
    const { error } = await _sb.auth.updateUser({ password: newPw });
    hideSpinner();
    if (error) { toast('Error: ' + error.message, 'error'); return; }
  
    document.getElementById('profileNewPw').value    = '';
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
      document.getElementById('avatarImg').src               = dataUrl;
      document.getElementById('avatarImg').style.display     = 'block';
      document.getElementById('avatarInitial').style.display = 'none';
      toast('Profile photo updated ✅');
    };
    reader.readAsDataURL(file);
  }