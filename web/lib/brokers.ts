export type BrokerStatus = "supported" | "partial" | "unsupported";
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
};

export const STATUS_META: Record<
  BrokerStatus,
  { label: string; color: string; bg: string; dot: string }
> = {
  supported: {
    label: "Supported",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    dot: "🟢",
  },
  partial: {
    label: "Partial",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/30",
    dot: "🟡",
  },
  unsupported: {
    label: "Unsupported",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/30",
    dot: "🔴",
  },
};

export const BROKERS: Broker[] = [
  {
    id: "ic-markets",
    name: "IC Markets",
    status: "supported",
    categories: ["forex", "futures"],
    platform: ["MT4", "MT5", "cTrader"],
    prop_firm: false,
    notes:
      "Full MT4/MT5 support. Drop our EA onto any chart and every trade is captured in real time with verified trust badges.",
    website: "https://www.icmarkets.com",
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
  },
  {
    id: "ftmo",
    name: "FTMO",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "FTMO allows third-party EAs that only read trade history. Our EA is read-only and complies with their rules.",
    website: "https://ftmo.com",
  },
  {
    id: "my-forex-funds",
    name: "My Forex Funds",
    status: "supported",
    categories: ["prop_firm", "forex"],
    platform: ["MT4", "MT5"],
    prop_firm: true,
    notes:
      "Read-only EA is permitted under their rules. Hook it up once and every challenge/funded trade is journaled.",
    website: "https://myforexfunds.com",
  },
  {
    id: "binance",
    name: "Binance",
    status: "supported",
    categories: ["crypto"],
    platform: ["WebSocket API"],
    prop_firm: false,
    notes:
      "Connect a read-only API key. Spot and Futures fills stream in over the user-data WebSocket — no polling, no delay.",
    website: "https://www.binance.com",
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
  },
  {
    id: "coinbase-advanced",
    name: "Coinbase Advanced",
    status: "supported",
    categories: ["crypto"],
    platform: ["WebSocket API"],
    prop_firm: false,
    notes:
      "Advanced Trade API key (view-only). Real-time fills via the authenticated WebSocket channel.",
    website: "https://www.coinbase.com/advanced-trade",
  },

  {
    id: "oanda",
    name: "OANDA",
    status: "partial",
    categories: ["forex", "stocks"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "MT4 works with our EA. OANDA's proprietary fxTrade platform is not yet supported — use MT4 to get full automation.",
    website: "https://www.oanda.com",
  },
  {
    id: "ig-markets",
    name: "IG Markets",
    status: "partial",
    categories: ["forex", "stocks", "futures"],
    platform: ["MT4"],
    prop_firm: false,
    notes:
      "MT4 is supported via EA. IG's web platform and L2 Dealer are not — switch to MT4 to journal automatically.",
    website: "https://www.ig.com",
  },
  {
    id: "the-5ers",
    name: "The 5%ers",
    status: "partial",
    categories: ["prop_firm", "forex"],
    platform: ["MT5"],
    prop_firm: true,
    notes:
      "MT5 EA works but their rules require manual approval before running third-party tools. Submit a ticket to them first.",
    website: "https://the5ers.com",
  },
  {
    id: "kraken",
    name: "Kraken",
    status: "partial",
    categories: ["crypto"],
    platform: ["REST API"],
    prop_firm: false,
    notes:
      "Kraken's REST endpoints are polled every 30s, so fills appear with a slight delay. A WebSocket integration is on the roadmap.",
    website: "https://www.kraken.com",
  },

  {
    id: "robinhood",
    name: "Robinhood",
    status: "unsupported",
    categories: ["stocks"],
    platform: [],
    prop_firm: false,
    notes:
      "Robinhood has no public API and prohibits third-party automation. Manual logging only.",
    website: "https://robinhood.com",
  },
  {
    id: "etoro",
    name: "eToro",
    status: "unsupported",
    categories: ["forex", "crypto", "stocks"],
    platform: [],
    prop_firm: false,
    notes:
      "eToro does not expose an API for retail users and runs a closed copy-trading platform. Manual logging only.",
    website: "https://www.etoro.com",
  },
  {
    id: "trading-212",
    name: "Trading 212",
    status: "unsupported",
    categories: ["stocks", "forex"],
    platform: [],
    prop_firm: false,
    notes:
      "No official public API and no MT4/MT5 access. Trades have to be journaled by hand for now.",
    website: "https://www.trading212.com",
  },
];
