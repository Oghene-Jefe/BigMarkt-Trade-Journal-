"use client";

import { useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import type { TradeRow } from "@/lib/types";
import {
  tradesToCSV,
  downloadCSV,
  formatTradesForPDF,
} from "@/lib/export";

interface ExportButtonsProps {
  trades: TradeRow[];
  isFiltered: boolean;
  filterLabel: string;
}

type Busy = "csv" | "pdf" | null;

const GOLD = "#D4AF37";
const GREEN = "#22c55e";
const RED = "#ef4444";
const BG = "#0a0a0a";
const ROW_DARK = "#141414";
const TEXT_WHITE = "#f5f5f5";
const TEXT_GRAY = "#a3a3a3";

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ExportButtons({
  trades,
  isFiltered,
  filterLabel,
}: ExportButtonsProps) {
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCSV() {
    setError(null);
    setBusy("csv");
    try {
      const csv = tradesToCSV(trades);
      const fname = isFiltered
        ? `bigmarkt-trades-filtered-${todayStr()}.csv`
        : `bigmarkt-trades-${todayStr()}.csv`;
      downloadCSV(csv, fname);
    } catch (e) {
      console.error("csv export failed", e);
      setError(e instanceof Error ? e.message : "CSV export failed");
    } finally {
      setBusy(null);
    }
  }

  async function handlePDF() {
    setError(null);
    setBusy("pdf");
    try {
      const data = formatTradesForPDF(trades);
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const marginX = 36;
      const bottomMargin = 48;

      function paintPageBackground() {
        pdf.setFillColor(BG);
        pdf.rect(0, 0, pageW, pageH, "F");
      }

      function drawHeader() {
        paintPageBackground();
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(18);
        pdf.setTextColor(GOLD);
        pdf.text("BIGMARKT TRADE LOG", pageW / 2, 50, { align: "center" });

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(TEXT_GRAY);
        const pnlSign = data.totalPnl >= 0 ? "+" : "-";
        const subtitle = `Generated: ${data.generatedAt} · ${data.totalTrades} trades · Win Rate: ${data.winRate.toFixed(0)}% · Net P&L: ${pnlSign}$${Math.abs(data.totalPnl).toFixed(2)}`;
        pdf.text(subtitle, pageW / 2, 68, { align: "center" });

        if (isFiltered && filterLabel) {
          pdf.setTextColor(GOLD);
          pdf.text(`Filter: ${filterLabel}`, pageW / 2, 82, { align: "center" });
        }
      }

      drawHeader();

      // One-line-per-trade list. Per the trade-log rules, a readable list
      // beats a brittle 15-column table on A4 portrait. The CSV carries
      // the full detail; the PDF is for at-a-glance review.
      let y = isFiltered && filterLabel ? 105 : 92;
      const rowH = 14;
      let page = 1;

      function ensureRoom() {
        if (y + rowH > pageH - bottomMargin) {
          pdf.addPage();
          page += 1;
          drawHeader();
          y = isFiltered && filterLabel ? 105 : 92;
        }
      }

      pdf.setFontSize(8.5);
      pdf.setFont("helvetica", "normal");

      data.rows.forEach((row, i) => {
        ensureRoom();
        // Zebra-stripe background
        const bg = i % 2 === 0 ? ROW_DARK : BG;
        pdf.setFillColor(bg);
        pdf.rect(marginX, y - 10, pageW - marginX * 2, rowH, "F");

        const [date, pair, dir, result, pnl, rr, lots, grade, entry, exit_, sl, tp, session, strategy, emotions] = row;

        // Result column gets a per-state color; everything else white.
        const resultColor =
          result === "WIN" ? GREEN : result === "LOSS" ? RED : result === "BE" ? GOLD : TEXT_GRAY;

        const colXs = [marginX + 4, marginX + 92, marginX + 138, marginX + 162, marginX + 200, marginX + 250, marginX + 285, marginX + 320];
        pdf.setTextColor(TEXT_WHITE);
        pdf.text(date ?? "", colXs[0]!, y);
        pdf.text(pair ?? "", colXs[1]!, y);
        pdf.text(dir ?? "", colXs[2]!, y);
        pdf.setTextColor(resultColor);
        pdf.text(result ?? "", colXs[3]!, y);
        const pnlNum = Number(pnl);
        pdf.setTextColor(Number.isFinite(pnlNum) && pnlNum < 0 ? RED : GREEN);
        pdf.text(pnl ? (pnlNum >= 0 ? `+$${pnl}` : `-$${Math.abs(pnlNum).toFixed(2)}`) : "", colXs[4]!, y);
        pdf.setTextColor(TEXT_GRAY);
        pdf.text(rr ? `RR ${rr}` : "", colXs[5]!, y);
        pdf.text(lots ? `${lots} lot` : "", colXs[6]!, y);
        pdf.setTextColor(TEXT_WHITE);
        pdf.text(grade ?? "", colXs[7]!, y);

        // Optional detail line below for entry/exit/session/strategy/emotions
        const details: string[] = [];
        if (entry) details.push(`E ${entry}`);
        if (exit_) details.push(`X ${exit_}`);
        if (sl) details.push(`SL ${sl}`);
        if (tp) details.push(`TP ${tp}`);
        if (session) details.push(session);
        if (strategy) details.push(strategy);
        if (emotions) details.push(emotions);
        if (details.length > 0) {
          y += 11;
          ensureRoom();
          pdf.setTextColor(TEXT_GRAY);
          pdf.setFontSize(7.5);
          pdf.text(details.join("  ·  "), marginX + 4, y);
          pdf.setFontSize(8.5);
        }
        y += rowH;
      });

      // Footer + page numbers across all pages.
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFontSize(8);
        pdf.setTextColor(TEXT_GRAY);
        pdf.text("journal.bigmarkt.co", pageW / 2, pageH - 22, { align: "center" });
        pdf.text(`Page ${p} of ${totalPages}`, pageW - marginX, pageH - 22, { align: "right" });
      }

      const fname = isFiltered
        ? `bigmarkt-trade-log-filtered-${todayStr()}.pdf`
        : `bigmarkt-trade-log-${todayStr()}.pdf`;
      pdf.save(fname);
    } catch (e) {
      console.error("pdf export failed", e);
      setError(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || trades.length === 0;

  return (
    <div className="flex flex-col items-end gap-1">
      <p className={`text-xs ${isFiltered ? "text-gold/70" : "text-muted"}`}>
        {isFiltered
          ? `Exporting ${trades.length} filtered trades (${filterLabel})`
          : `Exporting all ${trades.length} trades`}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCSV}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-gold bg-bg px-3 py-1.5 font-display text-xs tracking-widest text-gold transition hover:bg-gold hover:text-black disabled:opacity-50"
        >
          {busy === "csv" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          EXPORT CSV
        </button>
        <button
          type="button"
          onClick={handlePDF}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 rounded-md border border-gold bg-bg px-3 py-1.5 font-display text-xs tracking-widest text-gold transition hover:bg-gold hover:text-black disabled:opacity-50"
        >
          {busy === "pdf" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          EXPORT PDF
        </button>
      </div>
      {error ? <p className="text-xs text-loss">{error}</p> : null}
    </div>
  );
}
