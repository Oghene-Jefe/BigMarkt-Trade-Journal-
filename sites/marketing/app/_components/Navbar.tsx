"use client";

import Link from "next/link";
import { useState } from "react";
import Logo from "./Logo";

const links = [
  { href: "/protocol", label: "Protocol" },
  { href: "/token", label: "Token" },
  { href: "/ecosystem", label: "Ecosystem" },
  { href: "https://journal.bigmarkt.co", label: "Journal", external: true },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#1f1f1f] bg-[#0a0a0a]/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center"
          onClick={() => setOpen(false)}
        >
          <Logo size="md" />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-white/80 transition hover:text-[#C9A84C]"
              {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
            >
              {l.label}
            </Link>
          ))}
          <a
            href="https://journal.bigmarkt.co/signup"
            target="_blank"
            rel="noopener"
            className="bg-[#C9A84C] px-4 py-2 text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Start Free
          </a>
        </div>

        <button
          aria-label="Toggle menu"
          aria-expanded={open}
          className="md:hidden text-white"
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </nav>

      {open && (
        <div className="md:hidden border-t border-[#1f1f1f] bg-[#0a0a0a] px-6 py-4">
          <div className="flex flex-col gap-4">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-base text-white/80"
                {...(l.external ? { target: "_blank", rel: "noopener" } : {})}
              >
                {l.label}
              </Link>
            ))}
            <a
              href="https://journal.bigmarkt.co/signup"
              target="_blank"
              rel="noopener"
              className="bg-[#C9A84C] px-4 py-3 text-center text-sm font-semibold text-black"
            >
              Start Free
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
