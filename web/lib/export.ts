import type { TradeRow } from "@/lib/types";

const CSV_HEADERS = [
  "Date",
  "Pair",
  "Direction",
  "Result",
  "P&L ($)",
  "R:R Ratio",
  "Lot Size",
  "Setup Grade",
  "Entry",
  "Exit",
  "Stop Loss",
  "Take Profit",
  "Session",
  "Strategy",
  "Emotions",
  "Tags",
  "Notes",
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatTradeDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function normalizeTags(tags: string | null): string {
  if (!tags) return "";
  // Display-side tags are already a free-form string. Normalize the most
  // common separator (comma) to ";" so the CSV cell stays atomic when
  // re-opened in spreadsheet tools that auto-split on comma.
  return tags
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .join(";");
}

export function tradesToCSV(trades: TradeRow[]): string {
  const lines: string[] = [];
  lines.push(CSV_HEADERS.map(csvEscape).join(","));
  for (const t of trades) {
    const row = [
      formatTradeDate(t.created_at),
      t.pair,
      t.direction,
      t.result,
      t.pnl,
      t.rr_ratio,
      t.lot_size,
      t.setup_grade,
      t.entry_price,
      t.exit_price,
      t.stop_loss,
      t.take_profit,
      t.session,
      t.strategy,
      t.emotions,
      normalizeTags(t.tags),
      t.notes,
    ];
    lines.push(row.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const PDF_HEADERS = [
  "Date",
  "Pair",
  "Dir",
  "Result",
  "P&L",
  "RR",
  "Lots",
  "Grade",
  "Entry",
  "Exit",
  "SL",
  "TP",
  "Session",
  "Strategy",
  "Emotions",
];

function formatGeneratedAt(d: Date): string {
  const day = d.getDate();
  const month = d.toLocaleDateString(undefined, { month: "short" });
  const year = d.getFullYear();
  return `${day} ${month} ${year} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export type PDFTradeData = {
  headers: string[];
  rows: string[][];
  generatedAt: string;
  totalTrades: number;
  totalPnl: number;
  winRate: number;
};

export function formatTradesForPDF(trades: TradeRow[]): PDFTradeData {
  let wins = 0;
  let losses = 0;
  let totalPnl = 0;
  const rows: string[][] = trades.map((t) => {
    if (t.result === "WIN") wins += 1;
    else if (t.result === "LOSS") losses += 1;
    totalPnl += t.pnl ?? 0;
    return [
      formatTradeDate(t.created_at),
      t.pair ?? "",
      t.direction ?? "",
      t.result ?? "",
      t.pnl != null ? t.pnl.toFixed(2) : "",
      t.rr_ratio != null ? t.rr_ratio.toFixed(2) : "",
      t.lot_size != null ? String(t.lot_size) : "",
      t.setup_grade ?? "",
      t.entry_price != null ? String(t.entry_price) : "",
      t.exit_price != null ? String(t.exit_price) : "",
      t.stop_loss != null ? String(t.stop_loss) : "",
      t.take_profit != null ? String(t.take_profit) : "",
      t.session ?? "",
      t.strategy ?? "",
      t.emotions ?? "",
    ];
  });
  const closed = wins + losses;
  const winRate = closed > 0 ? (wins / closed) * 100 : 0;
  return {
    headers: PDF_HEADERS,
    rows,
    generatedAt: formatGeneratedAt(new Date()),
    totalTrades: trades.length,
    totalPnl,
    winRate,
  };
}
