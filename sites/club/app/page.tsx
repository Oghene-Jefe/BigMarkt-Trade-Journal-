import Link from "next/link";
import {
  Bitcoin,
  Building2,
  CandlestickChart,
  Globe,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Ticker from "./_components/Ticker";

type Track = { icon: LucideIcon; name: string; desc: string };

const tracks: Track[] = [
  { icon: Wallet,           name: "Money Foundations",       desc: "Build the financial base nobody taught you" },
  { icon: TrendingUp,       name: "Investing Fundamentals",  desc: "Stocks, bonds, ETFs and long-term wealth" },
  { icon: Bitcoin,          name: "Crypto & Digital Assets", desc: "Blockchain, DeFi and the digital economy" },
  { icon: Building2,        name: "Business Finance",        desc: "How money moves inside companies" },
  { icon: Globe,            name: "Global Markets",          desc: "Macroeconomics, geopolitics and market forces" },
  { icon: CandlestickChart, name: "Trading Track",           desc: "Technical analysis, risk management and live markets" },
];

const stats = [
  { value: "6", label: "Learning Tracks" },
  { value: "13", label: "Course Modules" },
  { value: "Free", label: "To Join" },
  { value: "Pioneer", label: "Cohort Now Forming" },
];

const tiers = [
  { name: "Explorer", price: "Free", body: "Access to community, tracks overview, announcements.", status: "Open" },
  { name: "Builder", price: "Free — Founding Phase", body: "Full track access, assignments, mentorship matching.", status: "Founding Members Only" },
  { name: "Leader", price: "Merit Only", body: "Chapter leadership, industry connections.", status: "By Selection" },
];


const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: "BigMarkt Club",
  url: "https://club.bigmarkt.co",
  logo: "https://club.bigmarkt.co/images/bigmarkt-logo.png",
  sameAs: [
    "https://x.com/bigmarkt_hq",
    "https://www.linkedin.com/company/bigmarkt",
    "https://www.instagram.com/bigmarkt_hq/",
    "https://t.me/bigmarkt_hq",
    "https://youtube.com/@bigmarkt_hq",
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden border-b border-[#1f1f1f]">
        <div className="absolute inset-0 gold-dots opacity-60" aria-hidden />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-6 py-24">
          <h1 className="text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            BigMarkt Club.
            <br />
            Learn money.
            <br />
            <span className="text-[#C9A84C]">For real this time.</span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-white/80 md:text-xl">
            Financial literacy. Trading skills. Mentorship launching soon.
          </p>
          <p className="mt-3 max-w-2xl text-white/60">
            Free to join. Built for students who want more than a degree.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link href="/join" className="bg-[#C9A84C] px-8 py-4 text-center text-sm font-semibold text-black transition hover:bg-[#d8b955]">
              Join Free
            </Link>
            <Link href="/about" className="border border-[#C9A84C] px-8 py-4 text-center text-sm font-semibold text-[#C9A84C] transition hover:bg-[#C9A84C] hover:text-black">
              Explore the Club
            </Link>
          </div>
        </div>
      </section>

      <Ticker />

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Universities teach you economics. Nobody teaches you money.
          </h2>
          <div className="mt-12 grid gap-12 md:grid-cols-2">
            <p className="text-white/70 md:text-lg">
              Most graduates enter the workforce with zero practical financial knowledge. No
              investing skills. No trading knowledge. No understanding of how money actually
              works. BigMarkt Club exists to change that.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {stats.map((s) => (
                <div key={s.label} className="border border-[#1f1f1f] bg-[#111111] p-6">
                  <div className="text-3xl font-bold text-[#C9A84C] md:text-4xl">{s.value}</div>
                  <div className="mt-2 text-sm text-white/70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Six tracks. One platform. Your choice.
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((t) => {
              const Icon = t.icon;
              return (
                <Link
                  key={t.name}
                  href="/tracks"
                  className="block border border-[#1f1f1f] bg-[#111111] p-6 transition hover:border-[#C9A84C]"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C]">
                    <Icon size={20} aria-hidden strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[#C9A84C]">{t.name}</h3>
                  <p className="mt-2 text-sm text-white/70">{t.desc}</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">The Progression</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.name} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-xl font-semibold text-[#C9A84C]">{t.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-widest text-white/40">{t.price}</p>
                <p className="mt-4 text-sm text-white/70">{t.body}</p>
                <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">Status: {t.status}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#C9A84C] px-6 py-20">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          <h2 className="text-3xl font-bold tracking-tight text-black md:text-4xl">
            Your campus has a library. It does not have this.
          </h2>
          <Link href="/join" className="bg-black px-8 py-4 text-sm font-semibold text-[#C9A84C] transition hover:bg-[#1a1a1a]">
            Join BigMarkt Club — Free
          </Link>
        </div>
      </section>
    </>
  );
}
