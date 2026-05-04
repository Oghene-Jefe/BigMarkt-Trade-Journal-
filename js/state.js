/* ================================================
   BIGMARKT TRADE JOURNAL — state.js
   Global app state + navigation
   ================================================ */

   let state = {
    user: null,
    trades: [],
    currentPage: 'dashboard',
    formDirection: 'BUY',
    formResult: 'WIN',
    formGrade: null,
    formTags: [],
    calYear: new Date().getFullYear(),
    calMonth: new Date().getMonth(),
    journalView: 'table'
  };
  
  /* ---------- navigation ---------- */
  function navigate(page) {
    state.currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-item[data-page]').forEach(n => {
      n.classList.toggle('active', n.dataset.page === page);
    });
  
    // Auto-scroll active nav item to center on narrow screens
    const activeNavBtn = document.querySelector('.nav-item.active[data-page]');
    if (activeNavBtn) {
      const nav = document.getElementById('bottomNav');
      const btnLeft = activeNavBtn.offsetLeft;
      const btnWidth = activeNavBtn.offsetWidth;
      const navWidth = nav.offsetWidth;
      nav.scrollTo({ left: btnLeft - navWidth / 2 + btnWidth / 2, behavior: 'smooth' });
    }
  
    if (page === 'dashboard') { renderDashboard(); checkSessionBanner(); }
    if (page === 'journal') {
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
    if (page === 'add') { resetTradeForm(); setDefaultTradeDate(); }
    if (page === 'profile') renderProfile();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  
  /* ---------- journal view switcher ---------- */
  function switchJournalView(view) {
    state.journalView = view;
  
    document.getElementById('journalTableView').style.display  = 'none';
    document.getElementById('journalCalView').style.display    = 'none';
    document.getElementById('journalReportView').style.display = 'none';
    document.getElementById('btnTableView').classList.remove('active');
    document.getElementById('btnCalView').classList.remove('active');
    document.getElementById('btnReportView').classList.remove('active');
  
    if (view === 'calendar') {
      document.getElementById('journalCalView').style.display = 'block';
      document.getElementById('btnCalView').classList.add('active');
      state.calYear  = new Date().getFullYear();
      state.calMonth = new Date().getMonth();
      renderCalendar();
    } else if (view === 'reports') {
      document.getElementById('journalReportView').style.display = 'block';
      document.getElementById('btnReportView').classList.add('active');
      renderReports();
    } else {
      document.getElementById('journalTableView').style.display = 'block';
      document.getElementById('btnTableView').classList.add('active');
      renderJournal();
    }
  }
  
  /* ---------- enter / exit app ---------- */
  function enterApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').classList.add('active');
    document.getElementById('bottomNav').style.display = 'flex';
    document.getElementById('calcFab').style.display = 'flex';
    navigate('dashboard');
  }