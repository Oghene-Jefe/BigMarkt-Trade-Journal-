import Link from "next/link";
import SocialLinks from "./SocialLinks";

const pageLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/tracks", label: "Tracks" },
  { href: "/chapters", label: "Chapters" },
  { href: "/mentorship", label: "Mentorship" },
  { href: "/join", label: "Join" },
];

export default function Footer() {
  return (
    <footer className="border-t border-[#1f1f1f] bg-[#0a0a0a] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A84C]">
              BigMarkt Club
            </div>
            <p className="mt-3 text-sm text-white/60">African roots. Global reach.</p>
            <p className="mt-4 text-sm text-white/60">
              <a href="mailto:contact@club.bigmarkt.co" className="hover:text-[#C9A84C]">
                contact@club.bigmarkt.co
              </a>
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Pages</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              {pageLinks.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-[#C9A84C]">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Ecosystem</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><a href="https://bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">BigMarkt Protocol</a></li>
              <li><a href="https://journal.bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">The Journal</a></li>
              <li><a href="https://fts.bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">FTS Academy</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Follow Us</h4>
            <div className="mt-4">
              <SocialLinks />
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-[#1f1f1f] pt-8">
          <p className="text-xs leading-relaxed text-white/40">
            BigMarkt Club is an educational community. Nothing on this site constitutes financial advice.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="text-xs text-white/40 hover:text-white/70">Privacy Policy</Link>
            <p className="text-xs text-white/40">© 2026 BigMarkt Club. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
