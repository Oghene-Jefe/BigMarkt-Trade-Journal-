"use client";
import { useState } from "react";

export default function ShareableLink({
  username,
  profileId,
}: {
  username: string | null;
  profileId: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!username) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <p className="text-xs uppercase tracking-wider text-muted mb-1">
          Shareable Profile Link
        </p>
        <p className="text-sm text-muted">
          Set a username in your profile settings to get your shareable link.
        </p>
      </div>
    );
  }

  const url = `https://journal.bigmarkt.co/@${username}`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <p className="text-xs uppercase tracking-wider text-muted mb-2">
        Shareable Profile Link
      </p>
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate font-mono text-sm text-gold">
          {url}
        </span>
        <button
          onClick={handleCopy}
          className="shrink-0 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-semibold hover:border-gold/50 hover:text-gold transition-colors"
        >
          {copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
    </div>
  );
}
