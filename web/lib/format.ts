// Tiny formatters shared by JournalTable + Dashboard. All accept null/undefined
// so server-rendered cells stay simple.
export function fmtMoney(
  n: number | null | undefined,
  currency?: string | null,
): string {
  if (n == null || !Number.isFinite(n)) return "â€”";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const num = abs.toLocaleString("en-US", { maximumFractionDigits: 2 });
  // Default ($) preserves every existing caller. When an account currency is
  // supplied (e.g. EUR, GBP), render the ISO code as a suffix instead of "$".
  if (currency && currency.toUpperCase() !== "USD") {
    return `${sign}${num} ${currency.toUpperCase()}`;
  }
  return `${sign}$${num}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "â€”";
  const t = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return "â€”";
  return t.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

export function fmtPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "â€”";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const t = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return "—";
  return t.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}