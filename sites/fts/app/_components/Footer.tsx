import Link from "next/link";
import SocialLinks from "./SocialLinks";

export default function Footer() {
  return (
    <footer className="border-t border-[#1f1f1f] bg-[#0a0a0a] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[#C9A84C]">
              FTS Free Trading Academy
            </div>
            <p className="mt-3 text-sm text-white/60">Learn the craft. Build the record.</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Academy</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link href="/" className="hover:text-[#C9A84C]">Home</Link></li>
              <li><Link href="/bootcamp" className="hover:text-[#C9A84C]">Boot Camp</Link></li>
              <li><Link href="/warroom" className="hover:text-[#C9A84C]">War Room</Link></li>
              <li><Link href="/about" className="hover:text-[#C9A84C]">About</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Ecosystem</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><a href="https://bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">BigMarkt Protocol</a></li>
              <li><a href="https://journal.bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">The Journal</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Community</h4>
            <div className="mt-4">
              <SocialLinks />
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-[#1f1f1f] pt-8">
          <p className="text-xs leading-relaxed text-white/40">
            Trading involves substantial risk of loss. This is an educational programme — not financial advice. Past performance is not indicative of future results.
          </p>
          <p className="mt-4 text-xs text-white/40">© 2026 Free Trading Academy. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
