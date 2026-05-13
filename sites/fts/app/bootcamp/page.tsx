import Link from "next/link";

export const metadata = {
  title: "Boot Camp — FTS Free Trading Academy",
  description: "A structured 13-module forex education programme for beginners to intermediate traders.",
};

const howItWorks = [
  { icon: "📱", title: "Telegram Group", body: "Join t.me/ftsbootcamp for community, support and announcements." },
  { icon: "🎥", title: "Live Classes", body: "Weekly sessions on Zoom and Google Meet. Recorded for replay." },
  { icon: "📝", title: "Assignments", body: "Each module has practical assignments to reinforce learning." },
];

const modules = [
  { n: 1, title: "Introduction to Forex Trading", body: "What forex is, currency pairs, market sessions, who trades forex." },
  { n: 2, title: "Forex Basics & Terminologies", body: "Pips, lot sizes, spread, leverage, margin, stop loss, take profit." },
  { n: 3, title: "Trading Platforms & Tools", body: "MT4/MT5, chart types, timeframes, placing trades, demo accounts." },
  { n: 4, title: "Technical Analysis", body: "Market structure, support & resistance, trendlines, candlestick patterns, breakouts." },
  { n: 5, title: "Fundamental Analysis", body: "Economic news, interest rates, NFP, economic calendar, central banks." },
  { n: 6, title: "Risk Management", body: "The 1-2% rule, risk-to-reward ratio, position sizing, drawdown, daily loss limits." },
  { n: 7, title: "Trading Strategy", body: "Trend + Support & Resistance + Confirmation strategy, trade checklist." },
  { n: 8, title: "Trading Psychology", body: "The 4 emotions, discipline system, revenge trading, consistency mindset." },
  { n: 9, title: "Trade Journaling", body: "What to record, how to review, key metrics, journal template." },
  { n: 10, title: "Demo Trading & Practice", body: "14-day demo challenge, performance evaluation, when to go live." },
  { n: 11, title: "Going Live", body: "Real trading transition, starting capital, first month rules, handling losses." },
  { n: 12, title: "Advanced Concepts (SMC Basics)", body: "Smart money, liquidity, order blocks, break of structure." },
  { n: 13, title: "Trading Plan Development", body: "Building your complete personal trading system." },
];

const requirements = [
  "A smartphone or laptop",
  "MT4 or MT5 installed (free)",
  "Commitment to follow the process",
];

export default function BootCampPage() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            <span className="text-[#C9A84C]">FTS</span> Boot Camp
          </h1>
          <p className="mt-6 max-w-2xl text-white/70 md:text-lg">
            A structured 13-module forex education programme for complete beginners to intermediate traders.
          </p>

          {/* Pioneer banner */}
          <div className="mt-10 border border-[#C9A84C] bg-[#C9A84C]/5 p-6">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">Pioneer Cohort Now Forming</div>
            <p className="mt-2 text-white/80">
              Be part of the first official FTS Boot Camp class. Limited spaces.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How it works</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {howItWorks.map((h) => (
              <div key={h.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <div className="text-3xl">{h.icon}</div>
                <h3 className="mt-4 text-lg font-semibold text-white">{h.title}</h3>
                <p className="mt-2 text-sm text-white/70">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">What You Will Learn</h2>
          <p className="mt-3 text-white/60">Thirteen modules. End-to-end.</p>
          <div className="mt-12 grid gap-4">
            {modules.map((m) => (
              <div key={m.n} className="flex gap-6 border border-[#1f1f1f] bg-[#111111] p-6">
                <div className="text-2xl font-bold text-[#C9A84C] md:text-3xl">
                  {String(m.n).padStart(2, "0")}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{m.title}</h3>
                  <p className="mt-1 text-sm text-white/70">{m.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Duration & needs */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">Duration & Format</h3>
            <p className="mt-4 text-white/80">
              6 to 12 weeks. 1 to 2 classes per week. Live sessions on Zoom and Google Meet. Assignments after each module. Certificate on completion.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">What You Need</h3>
            <ul className="mt-4 space-y-2 text-white/80">
              {requirements.map((r) => (
                <li key={r} className="flex gap-3">
                  <span className="text-[#C9A84C]">→</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Ready to start?</h2>
          <p className="mt-4 text-white/70">Apply for the pioneer cohort.</p>
          <Link
            href="/#apply"
            className="mt-8 inline-block bg-[#C9A84C] px-8 py-4 text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Apply for Boot Camp
          </Link>
        </div>
      </section>
    </>
  );
}
