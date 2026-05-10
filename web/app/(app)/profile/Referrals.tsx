"use client";

import { useState } from "react";

// Referral code is derived deterministically from user.id (base64, first 12)
// — matches the legacy static app's pattern in admin.js / profile.js so the
// existing referred_by values keep matching.
function refCodeFromId(id: string): string {
  // btoa expects a string of bytes; UUID is ASCII-safe.
  return btoa(id).replace(/=/g, "").substring(0, 12);
}

export default function Referrals({ userId, count }: { userId: string; count: number }) {
  const code = refCodeFromId(userId);
  const link = typeof window !== "undefined"
    ? `${window.location.origin}/?ref=${code}`
    : `/?ref=${code}`;

  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function copy(value: string, kind: "code" | "link") {
    navigator.clipboard?.writeText(value);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl tracking-widest text-gold">REFERRALS</h2>
      <div className="rounded-2xl border border-white/10 bg-panel p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Your code</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="rounded bg-black/40 px-2 py-1 text-sm">{code}</code>
              <button
                type="button"
                onClick={() => copy(code, "code")}
                className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5"
              >
                {copied === "code" ? "copied" : "copy"}
              </button>
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
              <button
                type="button"
                onClick={() => copy(link, "link")}
                className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5"
              >
                {copied === "link" ? "copied" : "copy"}
              </button>
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted">Signups via your link</p>
          <p className="mt-1 font-display text-3xl tracking-wider text-gold">{count}</p>
        </div>
      </div>
    </section>
  );
}
