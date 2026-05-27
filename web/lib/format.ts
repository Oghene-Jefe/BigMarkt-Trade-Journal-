// Tiny formatters shared by JournalTable + Dashboard. All accept null/undefined
// so server-rendered cells stay simple.
export function fmtMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "â€”";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "â€”";
  const t = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(t.getTime())) return "â€”";
  return t.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "â€”";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
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