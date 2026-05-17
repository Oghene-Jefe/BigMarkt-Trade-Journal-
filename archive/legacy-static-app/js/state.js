let state = {
  user: null,
  profile: null,
  trades: [],
  tradePage: 0,       // current pagination page (0-based)
  hasMore: false,     // true when more trades exist beyond what's loaded
  currentPage: 'dashboard',
  formDirection: 'BUY',
  formResult: 'WIN',
  formGrade: null,
  formTags: [],
  formTradeVisibility: 'public',
  calYear: new Date().getFullYear(),
  calMonth: new Date().getMonth(),
  journalView: 'table',
  resets: [],
  challenge: null,
  _lbData: null,
  _lbMode: 'quality',
  _admLbData: null,
  _admLbMode: 'quality'
};

let charts = { pnl: null, pair: null, emotion: null };

const ADMIN_EMAILS = ['sylvesterejemah@gmail.com', 'support@bigmarkt.co'];

const SESSIONS_UTC = [
  { name: 'Asian',    start: 23, end: 8,  emoji: '🌏', msg: 'Asian Session is LIVE — Tokyo & Sydney markets are open.' },
  { name: 'London',   start: 7,  end: 16, emoji: '🏦', msg: 'London Session is LIVE — highest liquidity window is open.' },
  { name: 'New York', start: 12, end: 21, emoji: '🗽', msg: 'New York Session is LIVE — NY open, big moves possible.' },
  { name: 'Overlap',  start: 12, end: 16, emoji: '⚡', msg: 'London–NY Overlap is LIVE — the sharpest moves happen now.' },
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
