// Single source of truth for per-instrument pip / contract values.
//
// Extracted from the risk calculator so the calculator UI and the Trading
// Constitution deviation engine compute money-risk from the SAME table and the
// SAME math. Pure module — no React, no DB.
//
// Money risk for a trade = |entry - stop| * pipFactor * pipValue * lot
//   • pipFactor converts a raw price difference into pip/point distance
//   • pipValue is $ per pip at 1.00 standard lot
// (mirrors the calculator's slDist → maxLoss derivation exactly).

export type Unit = "pips" | "points";

export type Instrument = {
  symbol: string;
  pipValue: number; // $ per pip at 1.00 standard lot
  unit: Unit;
  pipFactor: number; // multiplier to convert |entry - sl| price diff into pip/point distance
  hint: string;
  // True when pipValue is a cross-rate-dependent USD estimate (not exact). The
  // engine surfaces this as an "approximate" note on any risk-based violation.
  approximate?: boolean;
};

export const INSTRUMENTS: Record<string, Instrument[]> = {
  Metals: [
    {
      symbol: "XAU/USD",
      pipValue: 1,
      unit: "pips",
      pipFactor: 100,
      hint: "1 pip = $0.01 price move (2nd decimal). $4000→$4010 = 1000 pips. At 0.01 lot: 1 pip = $0.01.",
    },
    {
      symbol: "XAG/USD",
      pipValue: 5,
      unit: "pips",
      pipFactor: 1000,
      hint: "1 pip = $0.001 price move for Silver. Count from 3rd decimal. 0.01 lot × 1 pip = $0.05.",
    },
  ],
  "Forex Majors": [
    { symbol: "EUR/USD", pipValue: 10, unit: "pips", pipFactor: 10000, hint: "1 pip = 0.0001 (4th decimal). 0.01 lot × 1 pip = $0.10." },
    { symbol: "GBP/USD", pipValue: 10, unit: "pips", pipFactor: 10000, hint: "1 pip = 0.0001 (4th decimal). 0.01 lot × 1 pip = $0.10." },
    { symbol: "AUD/USD", pipValue: 10, unit: "pips", pipFactor: 10000, hint: "1 pip = 0.0001 (4th decimal). 0.01 lot × 1 pip = $0.10." },
    { symbol: "USD/CAD", pipValue: 7.5, unit: "pips", pipFactor: 10000, hint: "1 pip = 0.0001 (4th decimal). Pip value ≈ $7.50/lot.", approximate: true },
    { symbol: "USD/JPY", pipValue: 6.8, unit: "pips", pipFactor: 100, hint: "1 pip = 0.01 (2nd decimal for JPY). Pip value ≈ $6.80/lot.", approximate: true },
    { symbol: "GBP/JPY", pipValue: 6.8, unit: "pips", pipFactor: 100, hint: "1 pip = 0.01 (2nd decimal for JPY). Pip value ≈ $6.80/lot.", approximate: true },
    { symbol: "EUR/JPY", pipValue: 6.8, unit: "pips", pipFactor: 100, hint: "1 pip = 0.01 (2nd decimal for JPY). Pip value ≈ $6.80/lot.", approximate: true },
  ],
  Indices: [
    { symbol: "US30", pipValue: 1, unit: "points", pipFactor: 1, hint: "1 point = 1 index unit. Entry 39800, SL 39700 → 100 points." },
    { symbol: "NAS100", pipValue: 1, unit: "points", pipFactor: 1, hint: "1 point = 1 index unit. Entry 18000, SL 17950 → 50 points." },
    { symbol: "US500", pipValue: 1, unit: "points", pipFactor: 1, hint: "1 point = 1 index unit. Entry 5300, SL 5280 → 20 points." },
    { symbol: "UK100", pipValue: 1, unit: "points", pipFactor: 1, hint: "1 point = 1 index unit (FTSE)." },
    { symbol: "GER40", pipValue: 1, unit: "points", pipFactor: 1, hint: "1 point = 1 index unit (DAX)." },
  ],
  Oil: [
    { symbol: "USOIL", pipValue: 10, unit: "pips", pipFactor: 100, hint: "1 pip = $0.01 price move. 0.01 lot × 1 pip = $0.10." },
    { symbol: "UKOIL", pipValue: 10, unit: "pips", pipFactor: 100, hint: "1 pip = $0.01 price move. 0.01 lot × 1 pip = $0.10." },
  ],
  Crypto: [
    { symbol: "BTC/USD", pipValue: 1, unit: "pips", pipFactor: 1, hint: "1 pip = $1 price move. Entry $65,000, SL $64,500 → 500 pips." },
    { symbol: "ETH/USD", pipValue: 1, unit: "pips", pipFactor: 100, hint: "1 pip ≈ $0.01 price move. Use price diff × 100.", approximate: true },
    { symbol: "XRP/USD", pipValue: 1, unit: "pips", pipFactor: 10000, hint: "1 pip = $0.0001 price move. Multiply price diff × 10,000." },
  ],
  "Synthetics (Deriv)": [
    { symbol: "Boom 500", pipValue: 0.1, unit: "points", pipFactor: 1, hint: "Enter prices in points as shown on MT5/DTrader." },
    { symbol: "Boom 1000", pipValue: 0.1, unit: "points", pipFactor: 1, hint: "Enter prices in points as shown on MT5/DTrader." },
    { symbol: "Crash 500", pipValue: 0.1, unit: "points", pipFactor: 1, hint: "Enter prices in points as shown on MT5/DTrader." },
    { symbol: "Crash 1000", pipValue: 0.1, unit: "points", pipFactor: 1, hint: "Enter prices in points as shown on MT5/DTrader." },
    { symbol: "V75", pipValue: 0.1, unit: "points", pipFactor: 1, hint: "Volatility 75 Index — points from your chart." },
    { symbol: "V25", pipValue: 0.1, unit: "points", pipFactor: 1, hint: "Volatility 25 Index — points from your chart." },
  ],
};

export const ALL_INSTRUMENTS: Instrument[] = Object.values(INSTRUMENTS).flat();

// Normalize a symbol/pair to a comparable key: uppercase, strip everything that
// isn't a letter or digit. "XAU/USD" → "XAUUSD"; trade pair "XAUUSD" → "XAUUSD";
// "Boom 500" → "BOOM500".
export function normalizeSymbol(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const BY_KEY: Map<string, Instrument> = new Map(
  ALL_INSTRUMENTS.map((i) => [normalizeSymbol(i.symbol), i]),
);

// Resolve a trade pair (e.g. "XAUUSD") to its instrument, or null if uncovered.
export function findInstrument(pair: string | null | undefined): Instrument | null {
  if (!pair) return null;
  return BY_KEY.get(normalizeSymbol(pair)) ?? null;
}

export type RiskMoney = { riskMoney: number | null; approximate: boolean };

// Money at risk for a trade given entry, stop loss, lot and pair. Mirrors the
// calculator's maxLoss math. Uncovered instrument → riskMoney null + approximate.
// Guards against missing inputs and a zero stop distance.
export function computeRiskMoney(args: {
  entry: number | null | undefined;
  stopLoss: number | null | undefined;
  lot: number | null | undefined;
  pair: string | null | undefined;
}): RiskMoney {
  const { entry, stopLoss, lot, pair } = args;
  const inst = findInstrument(pair);
  if (!inst) return { riskMoney: null, approximate: true };
  if (
    entry == null || stopLoss == null || lot == null ||
    !Number.isFinite(entry) || !Number.isFinite(stopLoss) || !Number.isFinite(lot)
  ) {
    return { riskMoney: null, approximate: !!inst.approximate };
  }
  const slDist = Math.abs(entry - stopLoss) * inst.pipFactor;
  if (slDist <= 0 || lot <= 0) return { riskMoney: null, approximate: !!inst.approximate };
  const riskMoney = slDist * inst.pipValue * lot;
  return { riskMoney, approximate: !!inst.approximate };
}
