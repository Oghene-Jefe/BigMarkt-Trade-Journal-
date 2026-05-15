"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

// Referral code is derived deterministically from user.id (base64, first 12)
// — matches the legacy static app's pattern in admin.js / profile.js so the
// existing referred_by values keep matching.
function refCodeFromId(id: string): string {
  return btoa(id).replace(/=/g, "").substring(0, 12);
}

export default function Referrals({ userId, count }: { userId: string; count: number }) {
  const code = refCodeFromId(userId);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${code}`
      : `/signup?ref=${code}`;

  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function copy(value: string, kind: "code" | "link") {
    navigator.clipboard?.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-white">Referrals</h2>
      <div className="space-y-4 rounded-lg border border-white/10 bg-panel p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Your code</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-black/40 px-2 py-1 text-sm">{code}</code>
              <CopyButton
                onClick={() => copy(code, "code")}
                copied={copied === "code"}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs uppercase tracking-wider text-muted">Share link</p>
            <div className="mt-1 flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-1 text-xs text-muted"
              />
              <CopyButton
                onClick={() => copy(link, "link")}
                copied={copied === "link"}
              />
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Signups via your link</p>
          <p className="mt-1 text-3xl font-semibold text-gold tabular-nums">{count}</p>
        </div>
      </div>
    </section>
  );
}

function CopyButton({ onClick, copied }: { onClick: () => void; copied: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={copied ? "Copied" : "Copy"}
      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-xs hover:bg-white/5"
    >
      {copied ? (
        <>
          <Check size={12} aria-hidden />
          <span>Copied</span>
        </>
      ) : (
        <>
          <Copy size={12} aria-hidden />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}
