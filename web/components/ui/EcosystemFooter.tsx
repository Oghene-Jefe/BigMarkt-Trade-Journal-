// Logged-in app footer. Surfaces the four BigMarkt ecosystem sites
// (protocol, journal, campus club, academy) on every authenticated page.
// External links open in a new tab; the journal link stays internal.

import Link from "next/link";
import SocialLinks from "@/components/ui/SocialLinks";

type Link = {
  href: string;
  label: string;
  external?: boolean;
};

const LINKS: Link[] = [
  { href: "https://bigmarkt.co", label: "Protocol", external: true },
  { href: "/dashboard", label: "Journal" },
  { href: "/guide", label: "Guide" },
  { href: "https://club.bigmarkt.co", label: "Campus Club", external: true },
  { href: "https://fts.bigmarkt.co", label: "Academy", external: true },
  { href: "/privacy", label: "Privacy Policy" },
];

export function EcosystemFooter() {
  return (
    <footer className="mt-12 border-t border-white/10 bg-panel/40">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center">
        <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-start">
          {LINKS.map((l) =>
            l.external ? (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.href}
                href={l.href as never}
                className="hover:text-white"
              >
                {l.label}
              </Link>
            ),
          )}
        </nav>
        <SocialLinks />
        <p className="text-[11px] text-muted/70">© 2026 BigMarkt</p>
      </div>
    </footer>
  );
}
