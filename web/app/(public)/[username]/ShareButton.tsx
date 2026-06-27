"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export default function ShareButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 rounded border border-white/20 px-3 py-1.5 text-xs text-white/70 transition hover:border-white/40 hover:text-white"
    >
      {copied ? (
        <>
          <Check size={12} aria-hidden />
          Copied ✓
        </>
      ) : (
        <>
          <Share2 size={12} aria-hidden />
          Share
        </>
      )}
    </button>
  );
}
