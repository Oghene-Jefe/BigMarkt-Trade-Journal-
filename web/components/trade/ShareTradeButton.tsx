"use client";

import { useState, type RefObject } from "react";
import { toPng } from "html-to-image";
import { Share2, Download, Loader2 } from "lucide-react";

type Props = {
  cardRef: RefObject<HTMLDivElement | null>;
  pair: string;
  result: "WIN" | "LOSS" | "BREAKEVEN";
};

async function captureCard(node: HTMLDivElement): Promise<Blob> {
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    backgroundColor: "#0a0a0a",
    cacheBust: true,
  });
  const res = await fetch(dataUrl);
  return res.blob();
}

function fileName(pair: string, result: string): string {
  const safe = pair.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `bigmarkt-${safe}-${result.toLowerCase()}.png`;
}

export default function ShareTradeButton({ cardRef, pair, result }: Props) {
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    if (!cardRef.current) return;
    setError(null);
    setBusy("share");
    try {
      const blob = await captureCard(cardRef.current);
      const file = new File([blob], fileName(pair, result), { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (data: { files?: File[] }) => boolean;
        share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
      };

      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: `${pair} ${result}`,
          text: `${pair} ${result} — via BigMarkt`,
        });
      } else if (navigator.clipboard && "write" in navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setError("Copied to clipboard");
      } else {
        triggerDownload(blob, fileName(pair, result));
      }
    } catch (e) {
      console.error("share failed", e);
      setError(e instanceof Error ? e.message : "Share failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDownload() {
    if (!cardRef.current) return;
    setError(null);
    setBusy("download");
    try {
      const blob = await captureCard(cardRef.current);
      triggerDownload(blob, fileName(pair, result));
    } catch (e) {
      console.error("download failed", e);
      setError(e instanceof Error ? e.message : "Download failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleShare}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gold bg-bg px-4 py-2 font-display text-sm tracking-widest text-gold transition hover:bg-gold hover:text-black disabled:opacity-50"
        >
          {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
          SHARE
        </button>
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy !== null}
          className="flex flex-1 items-center justify-center gap-2 rounded-md border border-gold bg-bg px-4 py-2 font-display text-sm tracking-widest text-gold transition hover:bg-gold hover:text-black disabled:opacity-50"
        >
          {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          DOWNLOAD
        </button>
      </div>
      {error ? <p className="text-xs text-muted">{error}</p> : null}
    </div>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
