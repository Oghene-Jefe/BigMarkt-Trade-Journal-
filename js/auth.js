/* ================================================
   BIGMARKT TRADE JOURNAL — auth.js
   Login, signup, logout, password reset, demo gate
   ================================================ */

/* ---------- DEMO GATE ---------- */
function showDemoGate() {
    document.getElementById('demoGate').style.display = 'block';
    document.getElementById('demoBtn').style.display = 'none';
  }
  function hideDemoGate() {
    document.getElementById('demoGate').style.display = 'none';
    document.getElementById('demoBtn').style.display = 'flex';
  }
  
  async function submitDemoGate() {
    const name  = document.getElementById('demoName').value.trim();
    const email = document.getElementById('demoEmail').value.trim().toLowerCase();
    if (!name)  { toast('Enter your name.', 'error'); return; }
    if (!email || !email.includes('@')) { toast('Enter a valid email.', 'error'); return; }
  
    showSpinner('SETTING UP YOUR ACCOUNT…');
    await _sb.from('leads').upsert({ name, email, source: 'demo' }, { onConflict: 'email' });
  
    const demoPassword = 'BigMarktDemo2026!';
    let { error } = await _sb.auth.signInWithPassword({ email, password: demoPassword });
    if (error) {
      const { data: signUpData, error: signUpError } = await _sb.auth.signUp({
        email, password: demoPassword, options: { data: { name } }
      });
      if (signUpError) { hideSpinner(); toast('Error: ' + signUpError.message, 'error'); return; }
      await _sb.from('leads').upsert({ name, email, source: 'demo' }, { onConflict: 'email' });
      if (signUpData.user) {
        await _sb.from('profiles').upsert({ id: signUpData.user.id, email, name, source: 'demo' });
      }
      hideSpinner();
      document.getElementById('demoGate').innerHTML = `
        <div style="text-align:center; padding:10px 0;">
          <div style="font-size:40px; margin-bottom:12px;">📧</div>
          <div style="font-family:'Bebas Neue',sans-serif; font-size:22px; color:var(--gold); margin-bottom:8px;">VERIFY YOUR EMAIL</div>
          <div style="color:var(--muted); font-size:13px; line-height:1.6;">
            We sent a link to <strong style="color:var(--text);">${email}</strong><br>
            Click it to activate, then log in.
          </div>
          <button class="btn btn-ghost" style="margin-top:16px;" onclick="location.reload()">BACK TO LOGIN</button>
        </div>`;
      return;
    }
  
    const { data: { user } } = await _sb.auth.getUser();
    if (!user) { hideSpinner(); toast('Something went wrong. Try again.', 'error'); return; }
    state.user = user;
    await _sb.from('profiles').upsert({ id: user.id, email, name, source: 'demo' });
    await loadTrades();
    hideSpinner();
    enterApp();
    toast('Welcome, ' + name + '. Log your first trade! 🔥');
  }
  
  /* ---------- LOGIN ---------- */
  async function login(email, password) {
    showSpinner('SIGNING IN…');
    const { error } = await _sb.auth.signInWithPassword({ email, password });
    if (error) {
      hideSpinner();
      if (error.message.includes('Invalid login')) { toast('Wrong password.', 'error'); return; }
      showSpinner('CREATING ACCOUNT…');
      const { error: signUpError } = await _sb.auth.signUp({ email, password });
      if (signUpError) { hideSpinner(); toast(signUpError.message, 'error'); return; }
      await _sb.auth.signInWithPassword({ email, password });
    }
    const { data: { user } } = await _sb.auth.getUser();
    hideSpinner();
    if (!user) { toast('Login failed.', 'error'); return; }
    state.user = user;
    await _sb.from('profiles').upsert({ id: user.id, email, source: 'signup' });
    await loadTrades();
    enterApp();
    toast('Welcome back, trader.');
  }
  
  /* ---------- LOGOUT ---------- */
  async function logout() {
    await _sb.auth.signOut();
    state.user   = null;
    state.trades = [];
    document.getElementById('app').classList.remove('active');
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('calcFab').style.display   = 'none';
    closeCalcDrawer();
    document.getElementById('loginScreen').style.display = 'flex';
  }
  
  /* ---------- CHECK SESSION ON LOAD ---------- */
  async function checkSession() {
    showSpinner('LOADING…');
    const { data: { session } } = await _sb.auth.getSession();
    if (session) {
      state.user = session.user;
      await loadTrades();
      hideSpinner();
      enterApp();
    } else {
      hideSpinner();
    }
  }
  
  /* ---------- PASSWORD RESET ---------- */
  async function checkPasswordReset() {
    const hash        = window.location.hash;
    const params      = new URLSearchParams(hash.replace('#', '?'));
    const type        = params.get('type');
    const accessToken = params.get('access_token');
    const refreshToken= params.get('refresh_token');
  
    if (type === 'recovery' && accessToken) {
      await _sb.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
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
          <div class="login-footer">Built for traders <span>·</span> By traders <span>·</span> BigMarkt</div>
        </div>`;
      history.replaceState(null, '', window.location.pathname);
      return true;
    }
    return false;
  }
  
  async function submitNewPassword() {
    const newPwd     = document.getElementById('newPassword').value;
    const confirmPwd = document.getElementById('confirmPassword').value;
    if (!newPwd || newPwd.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
    if (newPwd !== confirmPwd)        { toast('Passwords do not match.', 'error'); return; }
    const { error } = await _sb.auth.updateUser({ password: newPwd });
    if (error) { toast('Error: ' + error.message, 'error'); return; }
    await _sb.auth.signOut();
    toast('Password updated! Please log in with your new password.');
    setTimeout(() => location.reload(), 2000);
  }
  
  function showForgotPassword() { document.getElementById('forgotModal').classList.add('show'); }
  function hideForgotPassword() { document.getElementById('forgotModal').classList.remove('show'); }
  
  async function sendResetEmail() {
    const email = document.getElementById('forgotEmail').value.trim().toLowerCase();
    if (!email) { toast('Enter your email.', 'error'); return; }
    showSpinner('SENDING RESET EMAIL…');
    const { error } = await _sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://journal.bigmarkt.co'
    });
    hideSpinner();
    if (error) { toast(error.message, 'error'); return; }
    toast('Reset link sent! Check your inbox.');
    hideForgotPassword();
  }
  
  /* ---------- PASSWORD EYE TOGGLE ---------- */
  function togglePw(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
    else                           { input.type = 'password'; btn.textContent = '👁'; }
  }
  
  /* ---------- AUTH MODE (login / signup toggle) ---------- */
  let authMode = 'login';
  function setAuthMode(mode) {
    authMode = mode;
    document.getElementById('fieldName').style.display       = mode === 'signup' ? 'block' : 'none';
    document.getElementById('authSubmitBtn').textContent     = mode === 'signup' ? 'CREATE ACCOUNT' : 'ENTER THE MARKET';
    document.getElementById('modeLogin').classList.toggle('active',  mode === 'login');
    document.getElementById('modeSignup').classList.toggle('active', mode === 'signup');
  }
  
  /* ---------- REFERRAL CODE ---------- */
  function checkReferralCode() {
    const params = new URLSearchParams(window.location.search);
    const ref    = params.get('ref');
    if (ref) localStorage.setItem('bm_ref', ref);
  }
  
  /* ---------- LOGIN FORM SUBMIT ---------- */
  // Runs after DOM is ready — called from app.js
  function initLoginForm() {
    document.getElementById('loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const pwd   = document.getElementById('loginPassword').value;
      const name  = document.getElementById('loginName').value.trim();
      if (!email || !pwd) return;
  
      if (authMode === 'signup') {
        if (!name) { toast('Enter your name.', 'error'); return; }
        showSpinner('CREATING ACCOUNT…');
        const { data, error } = await _sb.auth.signUp({
          email, password: pwd, options: { data: { name } }
        });
        hideSpinner();
        if (error) { toast(error.message, 'error'); return; }
        if (data.user) {
          await _sb.from('profiles').upsert({
            id: data.user.id, email, name, source: 'signup',
            referred_by: localStorage.getItem('bm_ref') || null
          });
          localStorage.removeItem('bm_ref');
          document.getElementById('loginForm').innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
              <div style="font-size:48px; margin-bottom:16px;">📧</div>
              <div style="font-family:'Bebas Neue',sans-serif; font-size:26px; color:var(--gold); margin-bottom:10px;">CHECK YOUR EMAIL</div>
              <div style="color:var(--muted); font-size:14px; line-height:1.6;">
                We sent a verification link to<br>
                <strong style="color:var(--text);">${email}</strong><br><br>
                Click the link in the email to activate your account, then come back to log in.
              </div>
              <button class="btn btn-ghost" style="margin-top:20px;" onclick="location.reload()">BACK TO LOGIN</button>
            </div>`;
        }
      } else {
        await login(email, pwd);
      }
    });
  }