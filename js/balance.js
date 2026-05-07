/* ====================================================
   BALANCE RESET
   ==================================================== */
async function loadResets() {
  if (!state.user) return;
  const { data } = await _sb.from('balance_resets')
    .select('*').eq('user_id', state.user.id)
    .order('created_at', { ascending: false }).limit(10);
  state.resets = data || [];
}

function openResetModal() {
  const modal = document.getElementById('resetModal');
  if (!modal) return;
  document.getElementById('resetNewBalance').value = '';
  document.getElementById('resetNote').value = '';
  modal.classList.add('show');
}

function closeResetModal() {
  document.getElementById('resetModal')?.classList.remove('show');
}

async function confirmBalanceReset() {
  const val = document.getElementById('resetNewBalance')?.value;
  const note = document.getElementById('resetNote')?.value?.trim() || null;
  if (!val || isNaN(Number(val)) || Number(val) <= 0) { toast('Enter a valid balance amount.', 'error'); return; }
  const newBalance = Number(val);
  showSpinner('RESETTING BALANCE…');
  const oldBalance = state.profile?.starting_balance || null;
  const [profileRes, resetRes] = await Promise.all([
    _sb.from('profiles').upsert({ id: state.user.id, email: state.user.email, starting_balance: newBalance }),
    _sb.from('balance_resets').insert({ user_id: state.user.id, old_balance: oldBalance, new_balance: newBalance, note })
  ]);
  hideSpinner();
  if (profileRes.error) { toast('Error saving balance.', 'error'); return; }
  state.profile = { ...state.profile, starting_balance: newBalance };
  if (!resetRes.error) {
    state.resets = [{ created_at: new Date().toISOString(), old_balance: oldBalance, new_balance: newBalance, note }, ...state.resets].slice(0, 10);
  }
  closeResetModal();
  toast('Balance reset to ' + fmtMoney(newBalance) + ' ✅');
  renderDashboard();
}

function toggleResetHistory() {
  const section = document.getElementById('resetHistSection');
  if (!section) return;
  const isHidden = section.style.display === 'none';
  section.style.display = isHidden ? '' : 'none';
  const btn = section.nextElementSibling;
  if (btn) btn.textContent = (isHidden ? '▾' : '▸') + ' Reset History (' + state.resets.length + ')';
}
