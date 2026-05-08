/* ---------- AUTH ---------- */
let authMode = 'login';
let _loggingOut = false;        // true during intentional logout — suppresses session-expiry handler
let _sessionExpiredShown = false; // prevents double-triggering from fetch + onAuthStateChange

async function login(email, password) {
  showSpinner('SIGNING IN…');
  let data, error;
  try {
    ({ data, error } = await _sb.auth.signInWithPassword({ email, password }));
  } catch (e) {
    toast('Network error — check your connection and try again.', 'error');
    return;
  } finally {
    hideSpinner();
  }

  if (error) {
    const msg = error.message || '';
    // Supabase v2 returns 'Invalid login credentials' for wrong email/password
    if (msg.includes('Invalid login credentials') || msg.includes('invalid_credentials') ||
        msg.includes('Invalid login') || msg.includes('wrong password')) {
      toast('Wrong email or password. Try again.', 'error'); return;
    }
    if (msg.includes('Email not confirmed') || msg.includes('email_not_confirmed')) {
      toast('Verify your email first - check your inbox.', 'error'); return;
    }
    if (msg.includes('Too many requests') || msg.includes('rate_limit')) {
      toast('Too many attempts - wait 60 seconds and try again.', 'error'); return;
    }
    toast(msg || 'Login failed. Try again.', 'error'); return;
  }

  const user = data?.user;
  if (!user) { toast('Login failed - please try again.', 'error'); return; }
  state.user = user;
  const confirmedAt = user.email_confirmed_at ? new Date(user.email_confirmed_at).getTime() : 0;
  const justVerified = confirmedAt > 0 && (Date.now() - confirmedAt) < 60000;
  await _sb.from('profiles').upsert({ id: user.id, email });
  await Promise.all([loadTrades(), loadProfile(), loadResets()]);
  setNavAvatar(state.profile?.avatar_url || null);
  enterApp();
  toast(justVerified ? 'Email verified! Welcome to BigMarkt.' : 'Welcome back, trader.');
  maybeShowOnboarding();
}


function enterApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').classList.add('active');
  document.getElementById('bottomNav').style.display = 'flex';
  document.getElementById('calcFab').style.display = 'flex';
  document.getElementById('adminNavBtn').style.display = isAdmin() ? '' : 'none';
  document.getElementById('lbNavBtn').style.display = '';
  navigate('dashboard');
}

async function logout() {
  _loggingOut = true;
  await _sb.auth.signOut();
  state.user = null;
  state.profile = null;
  state.trades = [];
  state.resets = [];
  state._lbData = null;
  state._lbMode = 'quality';
  state._admLbData = null;
  state._admLbMode = 'quality';
  state.currentPage = 'dashboard';
  state.formDirection = 'BUY';
  state.formResult = 'WIN';
  state.formGrade = null;
  state.formTags = [];
  state.calYear = new Date().getFullYear();
  state.calMonth = new Date().getMonth();
  state.journalView = 'table';
  document.getElementById('app').classList.remove('active');
  document.getElementById('bottomNav').style.display = 'none';
  document.getElementById('calcFab').style.display = 'none';
  document.getElementById('adminNavBtn').style.display = 'none';
  document.getElementById('lbNavBtn').style.display = 'none';
  closeCalcDrawer();
  document.getElementById('loginScreen').style.display = 'flex';
}

async function checkSession() {
  showSpinner('LOADING…');

  // Standard session check (email/password login)
  const { data: { session }, error: sessionError } = await _sb.auth.getSession();
  if (sessionError) { hideSpinner(); return; }
  if (session) {
    state.user = session.user;
    await Promise.all([loadTrades(), loadProfile(), loadResets()]);
    hideSpinner();
    setNavAvatar(state.profile?.avatar_url || null);
    enterApp();
    maybeShowOnboarding();
  } else {
    hideSpinner();
  }
}

async function handleLoginSubmit() {
  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const pwd   = document.getElementById('loginPassword').value;
  const name  = document.getElementById('loginName').value.trim();
  if (!email) { toast('Enter your email address.', 'error'); document.getElementById('loginEmail').focus(); return; }
  if (!pwd) { toast('Enter your password.', 'error'); document.getElementById('loginPassword').focus(); return; }
  if (pwd.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }

  if (authMode === 'signup') {
    // Honeypot check — only relevant on signup; bots fill hidden fields, humans don't
    const hp = document.getElementById('website');
    if (hp && hp.value) { console.log('Bot detected, signup blocked'); return; }
    if (!name) { toast('Enter your name.', 'error'); return; }
    showSpinner('CREATING ACCOUNT…');
    const { data, error } = await _sb.auth.signUp({ email, password: pwd, options: { data: { name } } });
    hideSpinner();
    if (error) {
      const msg = error.message || '';
      if (msg.includes('User already registered') || msg.includes('already been registered')) {
        toast('This email already has an account — switch to LOGIN and sign in instead.', 'error');
        return;
      }
      toast(msg || 'Signup failed. Try again.', 'error'); return;
    }
    if (data.user) {
      await _sb.from('profiles').upsert({ id: data.user.id, email, name, source: 'signup', referred_by: localStorage.getItem('bm_ref') || null });
      localStorage.removeItem('bm_ref');
      if (data.session) {
        state.user = data.user;
        await Promise.all([loadTrades(), loadProfile(), loadResets()]);
        setNavAvatar(state.profile?.avatar_url || null);
        enterApp();
        toast('Welcome, ' + name + '. Log your first trade!');
        maybeShowOnboarding();
        return;
      }
      document.getElementById('loginForm').innerHTML = `
        <div style="text-align:center; padding: 20px 0;">
          <div style="font-size:48px; margin-bottom:16px;">📧</div>
          <div style="font-family:'Bebas Neue',sans-serif; font-size:26px; color:var(--gold); margin-bottom:10px;">CHECK YOUR EMAIL</div>
          <div style="color:var(--muted); font-size:14px; line-height:1.6;">
            We sent a verification link to<br>
            <strong id="confirmEmailAddr" style="color:var(--text);"></strong><br><br>
            Click the link in the email to activate your account, then come back to log in.
          </div>
          <button class="btn btn-ghost" style="margin-top:20px;" onclick="location.reload()">BACK TO LOGIN</button>
        </div>`;
      document.getElementById('confirmEmailAddr').textContent = email;
    }
  } else {
    await login(email, pwd);
  }
}

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById('fieldName').style.display = mode === 'signup' ? 'block' : 'none';
  document.getElementById('authSubmitBtn').textContent = mode === 'signup' ? 'CREATE ACCOUNT' : 'ENTER THE MARKET';
  document.getElementById('modeLogin').classList.toggle('active', mode === 'login');
  document.getElementById('modeSignup').classList.toggle('active', mode === 'signup');
}

/* ====================================================
   PASSWORD RESET HANDLER
   Catches Supabase reset token from URL on page load
   ==================================================== */
async function checkPasswordReset() {
  const hash = window.location.hash;
  const params = new URLSearchParams(hash.replace('#', '?'));
  const type = params.get('type');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');

  if (type === 'recovery' && accessToken) {
    // Set the session from the reset link tokens
    const { error: sessionErr } = await _sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (sessionErr) { toast('Reset link expired or invalid. Request a new one.', 'error'); return false; }

    // Hide login, show reset form
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginScreen').innerHTML = `
      <div class="login-card">
        <div class="brand-stack">
          <div class="brand-mark">
            <div class="bm-wordmark">
              <span class="bm-big">Big</span><span class="bm-m">M</span>
              <span class="bm-a-wrap"><span class="bm-a-tri"></span></span>
              <span class="bm-rkt">rkt</span>
            </div>
          </div>
          <div class="login-tag">FTS Trade Journal</div>
          <div class="login-headline">SET NEW <em>PASSWORD</em></div>
          <div class="login-sub">Choose a strong password for your account.</div>
        </div>

        <div class="field">
          <label>New Password</label>
          <div class="field-pw">
            <input type="password" id="newPassword" placeholder="Min 6 characters" minlength="6">
            <button type="button" class="pw-eye" onclick="togglePw('newPassword', this)">👁</button>
          </div>
        </div>
        <div class="field">
          <label>Confirm Password</label>
          <div class="field-pw">
            <input type="password" id="confirmPassword" placeholder="Repeat password" minlength="6">
            <button type="button" class="pw-eye" onclick="togglePw('confirmPassword', this)">👁</button>
          </div>
        </div>
        <button class="btn btn-primary" onclick="submitNewPassword()" style="margin-top:8px;">SET PASSWORD</button>

        <div class="login-footer">
          Built for traders <span>·</span> By traders <span>·</span> BigMarkt
        </div>
      </div>`;

    // Clear the hash from URL
    history.replaceState(null, '', window.location.pathname);
    return true; // stop normal session check
  }
  return false;
}

async function submitNewPassword() {
  const newPwd = document.getElementById('newPassword').value;
  const confirmPwd = document.getElementById('confirmPassword').value;

  if (!newPwd || newPwd.length < 6) {
    toast('Password must be at least 6 characters.', 'error'); return;
  }
  if (newPwd !== confirmPwd) {
    toast('Passwords do not match.', 'error'); return;
  }

  const { error } = await _sb.auth.updateUser({ password: newPwd });
  if (error) { toast('Error: ' + error.message, 'error'); return; }

  // Sign out and send back to login
  await _sb.auth.signOut();
  toast('Password updated! Please log in with your new password.');
  setTimeout(() => location.reload(), 2000);
}

/* ====================================================
   FORGOT PASSWORD
   ==================================================== */
function showForgotPassword() {
  document.getElementById('forgotModal').classList.add('show');
}
function hideForgotPassword() {
  document.getElementById('forgotModal').classList.remove('show');
}
async function sendResetEmail() {
  const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
  if (!email) { toast('Enter your email.', 'error'); return; }
  showSpinner('SENDING RESET EMAIL…');
  const { error } = await _sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });
  hideSpinner();
  if (error) { toast(error.message, 'error'); return; }
  toast('Reset link sent! Check your inbox.');
  hideForgotPassword();
}

function isAdmin() { return !!(state.user && ADMIN_EMAILS.includes(state.user.email)); }

/* ====================================================
   SESSION EXPIRY — shared handler for both triggers
   (onAuthStateChange SIGNED_OUT + global 401 fetch)
   ==================================================== */
function _forceLogout() {
  if (_sessionExpiredShown || _loggingOut) return;
  _sessionExpiredShown = true;
  toast('Session expired — please log in again', 'error');
  setTimeout(() => {
    _sessionExpiredShown = false;
    state.user = null;
    state.profile = null;
    state.trades = [];
    state.resets = [];
    state._lbData = null;
    state._admLbData = null;
    state.currentPage = 'dashboard';
    document.getElementById('app').classList.remove('active');
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('calcFab').style.display = 'none';
    document.getElementById('adminNavBtn').style.display = 'none';
    document.getElementById('lbNavBtn').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
  }, 2000);
}

// Intercept all fetch calls — if Supabase returns 401 while user is logged in, force logout
const _origFetch = window.fetch;
window.fetch = async function (...args) {
  const res = await _origFetch.apply(this, args);
  if (res.status === 401 && state.user && !_loggingOut) {
    _forceLogout();
  }
  return res;
};

// Handle token expiry / remote sign-out from Supabase auth state machine
_sb.auth.onAuthStateChange((event, _session) => {
  if (event === 'SIGNED_OUT' && state.user && !_loggingOut) {
    _forceLogout();
  }
});
