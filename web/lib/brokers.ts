export type BrokerStatus = "supported" | "partial" | "unsupported" | "inactive";
export type BrokerCategory = "forex" | "crypto" | "futures" | "stocks" | "prop_firm";

export type Broker = {
  id: string;
  name: string;
  status: BrokerStatus;
  categories: BrokerCategory[];
  platform: string[];
  prop_firm: boolean;
  notes: string;
  website?: string;
  connectPath?: string;
  eaDownload?: boolean;
};

// `dotClass` is a Tailwind background utility for a small status dot the
// callers render as <span class="h-2 w-2 rounded-full ${dotClass}" />.
// Replaced emoji glyphs (🟢🟡🔴⚫) that didn't fit the broader operational-UI
// no-emoji rule.
export const STATUS_META: Record<
  BrokerStatus,
  { label: string; color: string; bg: string; dotClass: string }
> = {
  supported: {
    label: "Supported",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    dotClass: "bg-emerald-400",
  },
  partial: {
    label: "Partial",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  unsupported: {
    label: "Unsupported",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
    dotClass: "bg-rose-400",
  },
  inactive: {
    label: "Inactive",
    color: "text-white/40",
    bg: "bg-white/5 border-white/10",
    dotClass: "bg-white/30",
  },
};

export const BROKERS: Broker[] = [
  // ── SUPPORTED — Retail Forex / Crypto ──────────────────────────────────────
  {
    id: "ic-markets",
    name: "IC Markets",
    status: "supported",
    categories: ["forex", "futures"],
    platform: ["MT4", "MT5", "cTrader"],
    prop_firm: false,
    notes:
      "Full MT4/MT5 support. Drop our read-only EA on any chart and every trade is captured live with verified trust badges.",
    website: "https://www.icmarkets.com",
    eaDownload: true,
  },
  {
    id: "pepperstone",
    name: "Pepperstone",
    status: "supported",
    categories: ["forex", "futures"],
    platform: ["MT4", "MT5", "cTrader"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA captures fills automatically. cTrader users can use the bridge plugin.",
    website: "https://pepperstone.com",
    eaDownload: true,
  },
  {
    id: "exness",
    name: "Exness",
    status: "supported",
    categories: ["forex", "crypto"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 fully supported. EA reads execution history in real time on both standard and pro accounts.",
    website: "https://www.exness.com",
    eaDownload: true,
  },
  {
    id: "xm",
    name: "XM",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA install takes under a minute. All account tiers (Micro, Standard, Ultra Low) work.",
    website: "https://www.xm.com",
    eaDownload: true,
  },
  {
    id: "fbs",
    name: "FBS",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4 and MT5 supported across all FBS account types — read-only EA is allowed.",
    website: "https://fbs.com",
    eaDownload: true,
  },
  {
    id: "octafx",
    name: "OctaFX",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA is supported on all OctaFX account types.",
    website: "https://www.octafx.com",
    eaDownload: true,
  },
  {
    id: "hfm",
    name: "HFM / HF Markets",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 supported. Drop the EA and every fill streams into your BigMarkt journal.",
    website: "https://www.hfm.com",
    eaDownload: true,
  },
  {
    id: "axess-markets",
    name: "Axess Markets",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA captures trades natively. No special account flag required.",
    website: "https://www.axessmarkets.com",
    eaDownload: true,
  },
  {
    id: "hantec-markets",
    name: "Hantec Markets",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA install is supported across retail account types.",
    website: "https://www.hantecmarkets.com",
    eaDownload: true,
  },
  {
    id: "fp-markets",
    name: "FP Markets",
    status: "supported",
    categories: ["forex", "futures"],
    platform: ["MT4", "MT5", "cTrader"],
    prop_firm: false,
    notes:
      "MT4, MT5, and cTrader all work — the read-only EA streams every fill in real time.",
    website: "https://www.fpmarkets.com",
    eaDownload: true,
  },
  {
    id: "tickmill",
    name: "Tickmill",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA captures all fills. Compatible with Tickmill Pro and VIP accounts.",
    website: "https://www.tickmill.com",
    eaDownload: true,
  },
  {
    id: "vantage-markets",
    name: "Vantage Markets",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5", "cTrader"],
    prop_firm: false,
    notes:
      "Full MT4/MT5/cTrader support. Read-only EA install on any chart.",
    website: "https://www.vantagemarkets.com",
    eaDownload: true,
  },
  {
    id: "blackbull-markets",
    name: "BlackBull Markets",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA streams trades live. ECN, Prime and Institutional tiers all work.",
    website: "https://blackbull.com",
    eaDownload: true,
  },
  {
    id: "eightcap",
    name: "EightCap",
    status: "supported",
    categories: ["forex", "crypto"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA supported. Crypto CFD instruments are journaled alongside FX automatically.",
    website: "https://www.eightcap.com",
    eaDownload: true,
  },
  {
    id: "axi",
    name: "Axi",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "MT4 fully supported. MT5 not offered by Axi at this time.",
    website: "https://www.axi.com",
    eaDownload: true,
  },
  {
    id: "admirals",
    name: "Admirals",
    status: "supported",
    categories: ["forex", "stocks"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4 and MT5 (including Supreme Edition) work with the read-only EA.",
    website: "https://admiralmarkets.com",
    eaDownload: true,
  },
  {
    id: "fxtm",
    name: "FXTM",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4 and MT5 fully supported across FXTM account types.",
    website: "https://www.fxtm.com",
    eaDownload: true,
  },
  {
    id: "eglobal",
    name: "eGlobal / MarketsForYou",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA captures fills on both eGlobal-branded and MarketsForYou accounts.",
    website: "https://www.marketsforyou.com",
    eaDownload: true,
  },
  {
    id: "alpari",
    name: "Alpari",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 supported. The read-only EA works on all Alpari live account types.",
    website: "https://alpari.com",
    eaDownload: true,
  },
  {
    id: "roboforex",
    name: "RoboForex",
    status: "supported",
    categories: ["forex", "crypto"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4 and MT5 (Pro, ECN, R StocksTrader linked) supported by the EA.",
    website: "https://roboforex.com",
    eaDownload: true,
  },
  {
    id: "fxgt",
    name: "FXGT",
    status: "supported",
    categories: ["forex", "crypto"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 EA captures forex and crypto CFD fills natively.",
    website: "https://www.fxgt.com",
    eaDownload: true,
  },
  {
    id: "thinkmarkets",
    name: "ThinkMarkets",
    status: "supported",
    categories: ["forex"],
    platform: ["MT4", "MT5", "ThinkTrader"],
    prop_firm: false,
    notes:
      "MT4/MT5 fully supported. ThinkTrader users can switch to MT4/MT5 to enable the EA.",
    website: "https://www.thinkmarkets.com",
    eaDownload: true,
  },

  // ── SUPPORTED — Crypto Exchanges ───────────────────────────────────────────
  {
    id: "binance",
    name: "Binance",
    status: "supported",
    categories: ["crypto"],
    platform: ["WebSocket API"],
    prop_firm: false,
    notes:
      "Connect a read-only API key — spot and futures fills stream in over the user-data WebSocket with no polling delay.",
    website: "https://www.binance.com",
    connectPath: "/exchanges/binance",
  },
  {
    id: "bybit",
    name: "Bybit",
    status: "supported",
    categories: ["crypto"],
    platform: ["WebSocket API"],
    prop_firm: false,
    notes:
      "Read-only API key with no withdraw permission. We validate the key on connect and stream order updates live.",
    website: "https://www.bybit.com",
    connectPath: "/exchanges/bybit",
  },
  {
    id: "coinbase-advanced",
    name: "Coinbase Advanced",
    status: "supported",
    categories: ["crypto"],
    platform: ["WebSocket API"],
    prop_firm: false,
    notes:
      "Advanced Trade view-only API key. Real-time fills over the authenticated WebSocket channel.",
    website: "https://www.coinbase.com/advanced-trade",
    connectPath: "/exchanges/coinbase",
  },

  // ── SUPPORTED — Prop Firms ─────────────────────────────────────────────────
  {
    id: "ftmo",
    name: "FTMO",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "FTMO permits read-only EAs that only read trade history. Journal-only — the EA reads your trades and never executes.",
    website: "https://ftmo.com",
    eaDownload: true,
  },
  {
    id: "my-forex-funds",
    name: "My Forex Funds",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "Read-only EA is allowed under their rules. Journal-only — the EA reads your trades and never executes.",
    website: "https://myforexfunds.com",
    eaDownload: true,
  },
  {
    id: "e8-funding",
    name: "E8 Funding",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 EA captures fills. Journal-only — copying disabled per prop firm policy.",
    website: "https://e8funding.com",
    eaDownload: true,
  },
  {
    id: "true-forex-funds",
    name: "True Forex Funds",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 read-only EA works on challenge and funded accounts. Journal-only.",
    website: "https://trueforexfunds.com",
    eaDownload: true,
  },
  {
    id: "fundednext",
    name: "FundedNext",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 EA supported across all FundedNext models. Journal-only — copying is permanently off.",
    website: "https://fundednext.com",
    eaDownload: true,
  },
  {
    id: "funded-engineer",
    name: "Funded Engineer",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT5"],
    prop_firm: true,
    notes:
      "MT5 EA works on Funded Engineer challenge and funded accounts. Journal-only.",
    website: "https://fundedengineer.com",
    eaDownload: true,
  },
  {
    id: "alpha-capital-group",
    name: "Alpha Capital Group",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 read-only EA accepted. Journal-only — the EA reads your trades and never executes.",
    website: "https://alphacapitalgroup.uk",
    eaDownload: true,
  },
  {
    id: "instant-funding",
    name: "Instant Funding",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 EA streams every fill. Journal-only for all Instant Funding accounts.",
    website: "https://instantfunding.com",
    eaDownload: true,
  },
  {
    id: "goat-funded",
    name: "GOAT Funded",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT5"],
    prop_firm: true,
    notes:
      "MT5 EA captures all trades. Journal-only — the EA reads your trades and never executes.",
    website: "https://goatfundedtrader.com",
    eaDownload: true,
  },
  {
    id: "maven-trading",
    name: "Maven Trading",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 read-only EA is allowed. Journal-only on Maven accounts.",
    website: "https://maven-trading.com",
    eaDownload: true,
  },
  {
    id: "atlas-funded",
    name: "Atlas Funded",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 EA captures fills. Journal-only per prop firm policy.",
    website: "https://atlasfunded.com",
    eaDownload: true,
  },
  {
    id: "blue-guardian",
    name: "Blue Guardian",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 read-only EA works on Blue Guardian challenge and funded accounts. Journal-only.",
    website: "https://blueguardian.com",
    eaDownload: true,
  },
  {
    id: "funding-pips",
    name: "Funding Pips",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 EA captures fills. Journal-only — the EA reads your trades and never executes.",
    website: "https://fundingpips.com",
    eaDownload: true,
  },
  {
    id: "the-funded-trader",
    name: "The Funded Trader",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 EA captures every fill. Journal-only for all Funded Trader account types.",
    website: "https://thefundedtraderprogram.com",
    eaDownload: true,
  },
  {
    id: "fidelcrest",
    name: "Fidelcrest",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 read-only EA allowed. Journal-only on Fidelcrest accounts.",
    website: "https://fidelcrest.com",
    eaDownload: true,
  },
  {
    id: "ofp-funding",
    name: "OFP Funding",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "MT4/MT5 EA streams fills in real time. Journal-only per prop firm rules.",
    website: "https://ofpfunding.com",
    eaDownload: true,
  },

  // ── PARTIAL ────────────────────────────────────────────────────────────────
  {
    id: "oanda",
    name: "OANDA",
    status: "partial",
    categories: ["forex", "stocks"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "MT4 works with our EA. OANDA's fxTrade API is not yet integrated — use MT4 for full automation.",
    website: "https://www.oanda.com",
    eaDownload: true,
  },
  {
    id: "ig-markets",
    name: "IG Markets",
    status: "partial",
    categories: ["forex", "stocks", "futures"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "MT4 is supported via EA. ProRealTime and the native IG API are not supported yet.",
    website: "https://www.ig.com",
    eaDownload: true,
  },
  {
    id: "kraken",
    name: "Kraken",
    status: "partial",
    categories: ["crypto"],
    platform: ["REST API"],
    prop_firm: false,
    notes:
      "REST polling is supported (~30s delay). WebSocket integration is on the roadmap for Phase 5.",
    website: "https://www.kraken.com",
  },
  {
    id: "deriv",
    name: "Deriv",
    status: "partial",
    categories: ["forex"],
    platform: ["MT5"],
    prop_firm: false,
    notes:
      "MT4 was deprecated in 2024. Some Deriv account types block EAs — verify your account tier before connecting.",
    website: "https://deriv.com",
    eaDownload: true,
  },
  {
    id: "saxo-bank",
    name: "Saxo Bank",
    status: "partial",
    categories: ["forex", "stocks"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "SaxoTraderGO is the primary platform; MT4 is available on request only. EA works once MT4 access is granted.",
    website: "https://www.home.saxo",
    eaDownload: true,
  },
  {
    id: "cmc-markets",
    name: "CMC Markets",
    status: "partial",
    categories: ["forex", "stocks"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "MT4 is not the primary CMC platform — some instruments and order types aren't available there.",
    website: "https://www.cmcmarkets.com",
    eaDownload: true,
  },
  {
    id: "swissquote",
    name: "Swissquote",
    status: "partial",
    categories: ["forex"],
    platform: ["MT4", "MT5"],
    prop_firm: false,
    notes:
      "MT4/MT5 access is restricted to institutional-tier accounts. Retail users get the proprietary platform only.",
    website: "https://www.swissquote.com",
    eaDownload: true,
  },
  {
    id: "interactive-brokers",
    name: "Interactive Brokers",
    status: "partial",
    categories: ["forex", "stocks"],
    platform: ["TWS API"],
    prop_firm: false,
    notes:
      "No MT4/MT5 access. TWS API integration is on the Phase 5 roadmap — manual logging for now.",
    website: "https://www.interactivebrokers.com",
  },
  {
    id: "capital-com",
    name: "Capital.com",
    status: "partial",
    categories: ["forex", "crypto"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "MT4 access on Capital.com is feature-limited — not all instruments stream through MT4.",
    website: "https://capital.com",
    eaDownload: true,
  },
  {
    id: "apex-trader-funding",
    name: "Apex Trader Funding",
    status: "partial",
    categories: ["futures", "prop_firm"],
    platform: ["NinjaTrader", "Rithmic"],
    prop_firm: true,
    notes:
      "Futures-only prop firm with no MT4/MT5 — NinjaTrader/Rithmic integration not yet built. Journal manually for now.",
    website: "https://apextraderfunding.com",
  },
  {
    id: "topstep",
    name: "TopStep",
    status: "partial",
    categories: ["futures", "prop_firm"],
    platform: ["NinjaTrader", "Rithmic"],
    prop_firm: true,
    notes:
      "Futures-only prop firm with no MT4/MT5. NinjaTrader/Rithmic integration is not yet built — manual entry for now.",
    website: "https://www.topstep.com",
  },
  {
    id: "the-5ers",
    name: "The 5%ers",
    status: "partial",
    categories: ["prop_firm", "forex"],
    platform: ["MT5"],
    prop_firm: true,
    notes:
      "MT5 EA works but some account types restrict EA access — verify your tier before installing. Journal-only.",
    website: "https://the5ers.com",
    eaDownload: true,
  },

  // ── UNSUPPORTED ────────────────────────────────────────────────────────────
  {
    id: "robinhood",
    name: "Robinhood",
    status: "unsupported",
    categories: ["stocks"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "No public API and no MT4/MT5. Manual entry only.",
    website: "https://robinhood.com",
  },
  {
    id: "etoro",
    name: "eToro",
    status: "unsupported",
    categories: ["forex", "crypto", "stocks"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "Closed copy-trading platform with no MT4/MT5 or open API. Manual entry only.",
    website: "https://www.etoro.com",
  },
  {
    id: "trading-212",
    name: "Trading 212",
    status: "unsupported",
    categories: ["stocks", "forex"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "No MT4/MT5 or public API. Trades have to be logged manually.",
    website: "https://www.trading212.com",
  },
  {
    id: "webull",
    name: "Webull",
    status: "unsupported",
    categories: ["stocks"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "Proprietary platform with no MT4/MT5 and no public retail API. Manual entry only.",
    website: "https://www.webull.com",
  },
  {
    id: "freetrade",
    name: "Freetrade",
    status: "unsupported",
    categories: ["stocks"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "UK stocks app with no API or MT4/MT5 access. Manual entry only.",
    website: "https://freetrade.io",
  },
  {
    id: "revolut",
    name: "Revolut",
    status: "unsupported",
    categories: ["forex", "stocks"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "Proprietary trading feature inside the banking app. No MT4/MT5 or open API.",
    website: "https://www.revolut.com",
  },
  {
    id: "libertex",
    name: "Libertex",
    status: "unsupported",
    categories: ["forex", "crypto"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "Proprietary platform only — no MT4/MT5 access for retail. Manual entry only.",
    website: "https://libertex.com",
  },
  {
    id: "plus500",
    name: "Plus500",
    status: "unsupported",
    categories: ["forex", "stocks"],
    platform: ["Proprietary"],
    prop_firm: false,
    notes:
      "Proprietary CFD platform with no MT4 and no public API. Manual entry only.",
    website: "https://www.plus500.com",
  },

  // ── INACTIVE ───────────────────────────────────────────────────────────────
  {
    id: "surgetrader",
    name: "SurgeTrader",
    status: "inactive",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "SurgeTrader operations have ceased. Listed here for reference only — no new connections accepted.",
    website: "https://surgetrader.com",
  },
];
