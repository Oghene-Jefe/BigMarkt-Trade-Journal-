"use client";

import { useState } from "react";

const STORAGE_KEY = "bmt_token_launch_email";

export default function EmailCapture() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!list.includes(trimmed)) list.push(trimmed);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      // storage may be unavailable; still show success
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="border border-[#C9A84C] bg-[#111111] p-6">
        <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">Confirmed</div>
        <p className="mt-2 text-white/85">You&apos;re on the list. We&apos;ll email you when $BMT launches.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@email.com"
        aria-label="Email address"
        className="flex-1 border border-[#1f1f1f] bg-[#0a0a0a] px-4 py-3 text-white placeholder:text-white/40 focus:border-[#C9A84C] focus:outline-none"
      />
      <button
        type="submit"
        className="bg-[#C9A84C] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-black transition hover:bg-[#d8b955]"
      >
        Notify Me
      </button>
      {error && <p className="text-sm text-red-400 sm:basis-full">{error}</p>}
    </form>
  );
}
