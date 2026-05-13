import Link from "next/link";

export const metadata = {
  title: "Tracks — BigMarkt Club",
  description: "Six learning tracks. Choose the one that fits your goals. All free.",
};

type Track = {
  n: string;
  name: string;
  forWhom: string;
  learn: string[];
  why: string;
};

const tracks: Track[] = [
  {
    n: "01",
    name: "Money Foundations",
    forWhom: "For complete beginners.",
    learn: [
      "Budgeting and saving",
      "Understanding debt",
      "Banking and financial products",
      "Inflation and purchasing power",
      "Building an emergency fund",
    ],
    why: "You cannot build wealth without a solid foundation. This track gives you the basics that schools skipped.",
  },
  {
    n: "02",
    name: "Investing Fundamentals",
    forWhom: "For students ready to grow wealth.",
    learn: [
      "Stocks and how stock markets work",
      "Bonds and fixed income",
      "ETFs and index funds",
      "Compound interest and long-term thinking",
      "How to open an investment account",
    ],
    why: "The earlier you start investing, the more time your money has to grow.",
  },
  {
    n: "03",
    name: "Crypto & Digital Assets",
    forWhom: "For the digitally curious.",
    learn: [
      "What blockchain is and how it works",
      "Bitcoin and Ethereum fundamentals",
      "DeFi basics",
      "Wallets and security",
      "Understanding crypto risk",
    ],
    why: "Digital assets are reshaping finance. Understand them before they are mainstream.",
  },
  {
    n: "04",
    name: "Business Finance",
    forWhom: "For future entrepreneurs and professionals.",
    learn: [
      "Reading financial statements",
      "Cash flow management",
      "How businesses raise capital",
      "Valuation basics",
      "Financial planning for startups",
    ],
    why: "Whether you build a company or work in one, understanding business finance is non-negotiable.",
  },
  {
    n: "05",
    name: "Global Markets",
    forWhom: "For macro thinkers.",
    learn: [
      "How central banks work",
      "Interest rates and their effects",
      "Geopolitics and currency movements",
      "Commodity markets",
      "Reading economic data",
    ],
    why: "Markets do not move randomly. They respond to the world. This track teaches you to read the world.",
  },
  {
    n: "06",
    name: "Trading Track",
    forWhom: "For serious market participants.",
    learn: [
      "Technical analysis and chart reading",
      "Risk management (the 1-2% rule)",
      "Trading psychology and discipline",
      "Strategy development",
      "Trade journaling",
    ],
    why: "Trading is a skill, not a gamble. This track teaches it like one. Pairs directly with FTS Boot Camp at fts.bigmarkt.co",
  },
];

export default function TracksPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Six Tracks. <span className="text-[#C9A84C]">One Club.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-white/70 md:text-lg">
            Choose the track that fits your goals. Switch anytime. All free.
          </p>
        </div>
      </section>

      {tracks.map((t, i) => {
        const reverse = i % 2 === 1;
        return (
          <section key={t.n} className="border-b border-[#1f1f1f] px-6 py-24">
            <div className={`mx-auto grid max-w-7xl items-start gap-12 md:grid-cols-2 ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
              <div>
                <div className="text-sm font-bold uppercase tracking-[0.3em] text-[#C9A84C]">{t.n}</div>
                <h2 className="mt-4 text-3xl font-bold tracking-tight md:text-5xl">{t.name}</h2>
                <p className="mt-4 text-sm uppercase tracking-widest text-white/40">{t.forWhom}</p>
                <p className="mt-8 text-white/80">{t.why}</p>
              </div>
              <div className="border border-[#1f1f1f] bg-[#111111] p-8">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">What You Learn</h3>
                <ul className="mt-6 space-y-3">
                  {t.learn.map((l) => (
                    <li key={l} className="flex gap-3 text-white/80">
                      <span className="text-[#C9A84C]">▸</span>
                      <span>{l}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        );
      })}

      <section className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Which track is right for you?
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((t) => (
              <Link
                key={t.name}
                href="/join"
                className="border border-[#C9A84C] px-6 py-4 text-center text-sm font-semibold text-[#C9A84C] transition hover:bg-[#C9A84C] hover:text-black"
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
