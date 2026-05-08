/* ====================================================
   PROFILE PAGE
   ==================================================== */
async function renderProfile() {
  if (!state.user) return;
  showSpinner('LOADING PROFILE…');
  // Only fetch profile here; referral stats use RPC below
  const { data: profile } = await _sb
    .from('profiles').select('*').eq('id', state.user.id).single();
  hideSpinner();
  const name = profile?.name || state.user.email.split('@')[0];
  const email = state.user.email;
  document.getElementById('avatarInitial').textContent = name.charAt(0).toUpperCase();
  document.getElementById('profileName').textContent = name;
  document.getElementById('profileEmail').textContent = email;
  document.getElementById('profileBadge').textContent = profile?.source === 'demo' ? 'Demo Trader' : 'FTS Member';
  setNavAvatar(profile?.avatar_url || null);
  document.getElementById('editProfileName').value = name;
  if (profile?.timezone) document.getElementById('editProfileTimezone').value = profile.timezone;
  if (profile?.experience) document.getElementById('editProfileExperience').value = profile.experience;
  if (profile?.preferred_pairs) document.getElementById('editProfilePairs').value = profile.preferred_pairs;
  if (profile?.starting_balance != null) document.getElementById('editStartingBalance').value = profile.starting_balance;
  if (profile?.daily_loss_limit != null) document.getElementById('editDailyLossLimit').value = profile.daily_loss_limit;
  else document.getElementById('editDailyLossLimit').value = 3;
  selectVisibility(profile?.visibility || 'private');
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

  // Populate referral section — real active count via server-side RPC
  // (avoids exposing cross-user trade data to the client)
  const refCode = btoa(state.user.id).replace(/=/g, '').substring(0, 12);
  const refLink = `https://journal.bigmarkt.co?ref=${refCode}`;
  const linkEl  = document.getElementById('referralLinkInput');
  if (linkEl) linkEl.value = refLink;

  const { data: refStats } = await _sb.rpc('get_referral_stats', { ref_code: refCode });
  const refTotal  = refStats?.total  || 0;
  const refActive = refStats?.active || 0;

  const totalEl  = document.getElementById('refTotalCount');
  const activeEl = document.getElementById('refActiveCount');
  const rankEl   = document.getElementById('refRank');

  if (totalEl)  totalEl.textContent  = refTotal;
  if (activeEl) activeEl.textContent = refActive; // real count — users with ≥1 trade

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

/* ====================================================
   IMAGE COMPRESSION
   Downscales to max 200×200 and re-encodes as JPEG 0.82.
   Files already under 50 KB are returned unchanged.
   ==================================================== */
function _compressAvatar(file) {
  return new Promise((resolve) => {
    if (file.size < 50 * 1024) { resolve(file); return; }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 200;
      let w = img.width, h = img.height;
      if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
      else       { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.82);
    };
    // On any error fall back to original file
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

/* ====================================================
   setNavAvatar(url)
   Single call to update every avatar element in the UI:
   profile page circle + nav profile button thumbnail.
   Pass null/undefined to revert to the initial letter.
   ==================================================== */
function setNavAvatar(url) {
  const img    = document.getElementById('avatarImg');
  const init   = document.getElementById('avatarInitial');
  const navImg = document.getElementById('navAvatarImg');
  const navSvg = document.getElementById('navAvatarSvg');

  if (url) {
    // Attach onerror before setting src — broken URLs fall back silently
    const fallback = () => {
      if (img)    { img.onerror = null; img.style.display = 'none'; }
      if (init)   init.style.display = '';
      if (navImg) { navImg.onerror = null; navImg.style.display = 'none'; }
      if (navSvg) navSvg.style.display = '';
    };
    if (img)    { img.onerror = fallback;    img.src = url;    img.style.display = 'block'; }
    if (init)   init.style.display = 'none';
    if (navImg) { navImg.onerror = fallback; navImg.src = url; navImg.style.display = 'block'; }
    if (navSvg) navSvg.style.display = 'none';
  } else {
    if (img)    img.style.display = 'none';
    if (init)   init.style.display = '';
    if (navImg) navImg.style.display = 'none';
    if (navSvg) navSvg.style.display = '';
  }
}

/* ====================================================
   AVATAR UPLOAD — Supabase Storage
   Compresses → uploads to avatars/{user_id}/avatar.jpg
   → saves public URL to profiles.avatar_url
   ==================================================== */
async function uploadAvatar(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) { toast('Image must be under 5MB.', 'error'); return; }

  // Dim the avatar circle as an upload-in-progress indicator
  const imgEl  = document.getElementById('avatarImg');
  const initEl = document.getElementById('avatarInitial');
  if (imgEl)  imgEl.style.opacity  = '0.45';
  if (initEl) initEl.style.opacity = '0.45';

  const blob = await _compressAvatar(file);

  // Path is deterministic: re-uploads upsert cleanly over the previous file
  const storagePath = state.user.id + '/avatar.jpg';
  const { error: uploadErr } = await _sb.storage
    .from('avatars')
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    if (imgEl)  imgEl.style.opacity  = '1';
    if (initEl) initEl.style.opacity = '1';
    toast('Avatar upload failed — please try again.', 'error');
    return;
  }

  // Get public URL — add cache-bust so browser shows new image immediately
  const { data: urlData } = _sb.storage.from('avatars').getPublicUrl(storagePath);
  const displayUrl = urlData.publicUrl + '?t=' + Date.now();

  // Persist clean URL (no cache param) to profiles table
  const { error: dbErr } = await _sb.from('profiles')
    .update({ avatar_url: urlData.publicUrl })
    .eq('id', state.user.id);

  if (imgEl)  imgEl.style.opacity  = '1';
  if (initEl) initEl.style.opacity = '1';

  if (dbErr) {
    console.error('Failed to save avatar_url to profiles:', dbErr.message);
    toast('Avatar upload failed — please try again.', 'error');
    return;
  }

  state.profile = { ...state.profile, avatar_url: urlData.publicUrl };
  setNavAvatar(displayUrl); // cache-busted URL for immediate display
  toast('Avatar updated ✅');
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

/* ====================================================
   PROFILE VISIBILITY
   ==================================================== */
function selectVisibility(value) {
  document.querySelectorAll('#visibilityOptions .visibility-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === value);
  });
  // Store on the container for saveVisibility() to read
  const container = document.getElementById('visibilityOptions');
  if (container) container.dataset.current = value;
}

async function saveVisibility() {
  const container = document.getElementById('visibilityOptions');
  if (!container) return;
  const visibility = container.dataset.current || 'private';
  showSpinner('SAVING…');
  const { error } = await _sb.from('profiles')
    .update({ visibility })
    .eq('id', state.user.id);
  hideSpinner();
  if (error) { toast('Error saving visibility setting.', 'error'); return; }
  state.profile = { ...state.profile, visibility };
  toast('Visibility updated ✅');
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
