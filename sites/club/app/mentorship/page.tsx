import Link from "next/link";

export const metadata = {
  title: "Mentorship — BigMarkt Club",
  description: "Each Builder and Leader tier member is matched with an industry mentor. The network is the education.",
};

const covers = [
  { title: "Career Navigation", body: "From student to professional — understanding your options in finance." },
  { title: "Technical Skills", body: "Practical knowledge from people doing it daily in the industry." },
  { title: "Network Building", body: "Introductions, references and relationships that open doors." },
  { title: "Personal Finance", body: "How professionals actually manage their own money." },
];

const mentors = [
  { cat: "Commercial Banking", name: "Adaeze N., VP at First Bank", profile: "Credit, lending, corporate banking careers." },
  { cat: "Investment Analysis", name: "Kwame A., Analyst at Investec", profile: "Stock research, valuation, asset management." },
  { cat: "Forex & Prop Trading", name: "Marcus T., Head Trader at Titan Capital", profile: "Live trading, SMC, risk management." },
  { cat: "Crypto & Blockchain", name: "Yemi O., DeFi Lead at Binance Africa", profile: "Digital assets, DeFi, exchange operations." },
  { cat: "Brokerage & Market Ops", name: "Fatima S., Director at IC Markets Africa", profile: "Market structure, execution, brokerage careers." },
  { cat: "Corporate Finance", name: "David K., CFO at Pan-African Holdings", profile: "FP&A, financial planning, corporate money." },
  { cat: "Entrepreneurship & Fintech", name: "Amina C., PayStack alumni", profile: "Startup finance, building in Africa, financial products." },
];

export default function MentorshipPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            The network is <span className="text-[#C9A84C]">the education.</span>
          </h1>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How It Works</h2>
          <p className="mt-6 text-white/80 md:text-lg">
            Each Builder and Leader tier member is matched with an industry mentor for monthly
            1-on-1 sessions. Mentors are professionals from across finance, trading, crypto, and
            entrepreneurship.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">What Mentorship Covers</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {covers.map((c) => (
              <div key={c.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-lg font-semibold text-[#C9A84C]">{c.title}</h3>
                <p className="mt-3 text-sm text-white/70">{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Mentor Categories</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {mentors.map((m, i) => (
              <div key={m.cat} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/40">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[#C9A84C]">{m.cat}</h3>
                <p className="mt-3 text-sm text-white">{m.name}</p>
                <p className="mt-2 text-sm text-white/70">{m.profile}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-white/40">
            Mentor names and affiliations are placeholders for launch. Real mentor profiles will
            be published when the programme opens.
          </p>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Become a Mentor</h2>
          <p className="mt-6 text-white/80 md:text-lg">
            We are looking for finance and trading professionals who want to give back. Time
            commitment: 1-2 hours per month. Impact: direct access to the next generation of
            African financial talent.
          </p>
          <Link
            href="/join?type=mentor"
            className="mt-10 inline-block bg-[#C9A84C] px-8 py-4 text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Apply to Become a Mentor
          </Link>
        </div>
      </section>
    </>
  );
}
