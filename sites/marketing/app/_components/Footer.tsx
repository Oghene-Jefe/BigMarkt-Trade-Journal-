import Link from "next/link";
import SocialLinks from "./SocialLinks";

export default function Footer() {
  return (
    <footer className="border-t border-[#1f1f1f] bg-[#0a0a0a] px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-4">
          <div>
            <div className="font-bold tracking-[0.2em] text-[#C9A84C]">BIGMARKT</div>
            <p className="mt-3 text-sm text-white/60">Trade. Journal. Verify.</p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Ecosystem</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><a href="https://journal.bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">The Journal</a></li>
              <li><a href="https://club.bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">The Campus Club</a></li>
              <li><a href="https://fts.bigmarkt.co" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">The Academy</a></li>
              <li><Link href="/" className="hover:text-[#C9A84C]">The Protocol</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Protocol</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><Link href="/protocol" className="hover:text-[#C9A84C]">Architecture</Link></li>
              <li><Link href="/ecosystem" className="hover:text-[#C9A84C]">Ecosystem</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-white/40">Get Started</h4>
            <ul className="mt-4 space-y-2 text-sm text-white/70">
              <li><a href="https://journal.bigmarkt.co/signup" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">Sign Up</a></li>
              <li><a href="https://journal.bigmarkt.co/leaderboard" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">Leaderboard</a></li>
              <li><a href="https://journal.bigmarkt.co/brokers" target="_blank" rel="noopener" className="hover:text-[#C9A84C]">Brokers</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-[#1f1f1f] pt-8">
          <p className="text-xs leading-relaxed text-white/40">
            Trading involves substantial risk of loss. Past performance is not indicative of future results. BigMarkt is a journaling and transparency tool, not a financial advisor.
          </p>
          <div className="mt-6 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
            <SocialLinks />
            <div className="flex items-center gap-4">
              <Link href="/privacy" className="text-xs text-white/40 hover:text-white/70">Privacy Policy</Link>
              <p className="text-xs text-white/40">© 2026 BigMarkt Protocol. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
