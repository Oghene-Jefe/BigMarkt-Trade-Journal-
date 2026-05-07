/* ---------- navigation ---------- */
function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-item[data-page]').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });

  // Auto-scroll the active nav item to center on narrow screens
  const activeNavBtn = document.querySelector('.nav-item.active[data-page]');
  if (activeNavBtn) {
    const nav = document.getElementById('bottomNav');
    const btnLeft = activeNavBtn.offsetLeft;
    const btnWidth = activeNavBtn.offsetWidth;
    const navWidth = nav.offsetWidth;
    nav.scrollTo({ left: btnLeft - navWidth / 2 + btnWidth / 2, behavior: 'smooth' });
  }

  if (page === 'admin') { if (!isAdmin()) { navigate('dashboard'); return; } renderAdmin(); }
  if (page === 'dashboard') { renderDashboard(); checkSessionBanner(); }
  if (page === 'journal') {
    // Always reset to table view on navigation
    document.getElementById('journalTableView').style.display  = 'block';
    document.getElementById('journalCalView').style.display    = 'none';
    document.getElementById('journalReportView').style.display = 'none';
    document.getElementById('btnTableView').classList.add('active');
    document.getElementById('btnCalView').classList.remove('active');
    document.getElementById('btnReportView').classList.remove('active');
    state.journalView = 'table';
    renderJournal();
  }
  if (page === 'analytics') renderAnalytics();
  if (page === 'leaderboard') renderLeaderboard();
  if (page === 'add') { resetTradeForm(); setDefaultTradeDate(); }
  if (page === 'profile') renderProfile();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------- INIT ---------- */
// readyState guard — since CDNs + script are now at bottom of body,
// DOM is already ready. This handles any edge case where it isn't.
function _initApp() {
  loadTheme();
  checkReferralCode();
  checkPasswordReset().then(isReset => {
    if (!isReset) checkSession();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initApp);
} else {
  _initApp();
}
