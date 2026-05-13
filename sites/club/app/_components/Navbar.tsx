"use client";

import Link from "next/link";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/tracks", label: "Tracks" },
  { href: "/chapters", label: "Chapters" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/join", label: "Join" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1f1f1f] bg-[#0a0a0a]/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A84C]"
          onClick={() => setOpen(false)}
        >
          BigMarkt Club
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-white/80 transition hover:text-[#C9A84C]"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/join"
            className="bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Join Free
          </Link>
        </div>

        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          className="md:hidden text-white"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </nav>

      {open && (
        <>
          <div
            className="fixed inset-0 top-16 z-40 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed right-0 top-16 bottom-0 z-50 flex w-72 max-w-[80vw] flex-col gap-1 border-l border-[#1f1f1f] bg-[#0a0a0a] px-6 py-6 md:hidden">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex min-h-12 items-center text-base text-white/80 transition hover:text-[#C9A84C]"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/join"
              onClick={() => setOpen(false)}
              className="mt-4 flex min-h-12 items-center justify-center bg-[#C9A84C] px-4 text-sm font-semibold text-black"
            >
              Join Free
            </Link>
          </aside>
        </>
      )}
    </header>
  );
}
