import Link from "next/link";
import { Suspense } from "react";
import StatBar from "./_components/StatBar";

export const metadata = {
  alternates: { canonical: "/" },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "BigMarkt",
  url: "https://www.bigmarkt.co",
  logo: "https://www.bigmarkt.co/images/bigmarkt-logo.png",
  description: "Verified trading journal for forex, crypto, stock and commodity traders",
  sameAs: [
    "https://x.com/bigmarkt_hq",
    "https://www.linkedin.com/company/bigmarkt",
    "https://www.instagram.com/bigmarkt_hq/",
    "https://t.me/bigmarkt_hq",
    "https://youtube.com/@bigmarkt_hq",
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "BigMarkt",
  url: "https://www.bigmarkt.co",
};

const features = [
  {
    tag: "AUTO-CAPTURED",
    body: "Your MT4/MT5 EA streams every fill into your journal. Timestamped server-side, never edited after the fact.",
  },
  {
    tag: "PUBLIC LEADERBOARD",
    body: "Ranked on real broker-reported performance — win rate, expectancy, drawdown. Trades come from your broker, not screenshots.",
  },
  {
    tag: "FOLLOW TOP TRADERS",
    body: "Follow verified traders. Their verified trades appear in your journal.",
  },
];

const layers = [
  { n: "01", name: "Proof Layer", desc: "Read-only EA captures every broker fill in real time.", phase: "Phase 1 · Live" },
  { n: "02", name: "Coordination Layer", desc: "Public leaderboards, profiles, and verified rank.", phase: "Phase 1 · Live" },
  { n: "03", name: "Accountability Layer", desc: "The Trading Constitution — rule-adherence on every verified trade.", phase: "Phase 1 · Live" },
  { n: "04", name: "Community Layer", desc: "A portable, community-owned reputation network.", phase: "Phase 4 · Planned" },
];

const ecosystem = [
  { domain: "journal.bigmarkt.co", title: "The Journal", desc: "The verified trading journal. Auto-capture, leaderboards, public profiles.", href: "https://journal.bigmarkt.co" },
  { domain: "club.bigmarkt.co", title: "The Campus Club", desc: "University trading community. Cohorts, challenges, peer review.", href: "https://club.bigmarkt.co" },
  { domain: "fts.bigmarkt.co", title: "The Academy", desc: "Forex training and certification. Structured curriculum.", href: "https://fts.bigmarkt.co" },
  { domain: "bigmarkt.co", title: "The Protocol", desc: "Where it all connects. Architecture, token, ecosystem.", href: "/" },
];

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static, hardcoded structured data — no user input.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {/* Hero */}
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden border-b border-[#1f1f1f]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.08),_transparent_60%)]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-6 py-24">
          <div className="mb-6 inline-flex items-center self-start gap-2 border border-[#1f1f1f] bg-[#111111] px-3 py-1 text-xs uppercase tracking-widest text-[#C9A84C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
            BigMarkt Protocol
          </div>

          <h1 className="font-bold leading-[1.05] tracking-tight text-4xl md:text-6xl lg:text-7xl">
            <span className="block text-white">The Verified</span>
            <span className="block text-white">Trading Journal.</span>
            <span className="block text-[#C9A84C]">Verified by your broker.</span>
          </h1>

          <p className="mt-8 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            Auto-capture every trade from your broker. Build a public record you can point to. Follow traders ranked on real, broker-reported performance.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="https://journal.bigmarkt.co/signup"
              target="_blank"
              rel="noopener"
              className="bg-[#C9A84C] px-8 py-4 text-center text-sm font-semibold uppercase tracking-wider text-black transition hover:bg-[#d8b955]"
            >
              Start Free
            </a>
            <a
              href="#how-it-works"
              className="border border-[#C9A84C] px-8 py-4 text-center text-sm font-semibold uppercase tracking-wider text-[#C9A84C] transition hover:bg-[#C9A84C]/10"
            >
              How it works
            </a>
          </div>

          <div className="mt-16 max-w-3xl">
            <Suspense fallback={<div className="h-24 border border-[#1f1f1f] bg-[#111111]" />}>
              <StatBar />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight md:text-5xl">
            Not self-reported. <span className="text-[#C9A84C]">Verified.</span>
          </h2>
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div key={f.tag} className="border border-[#1f1f1f] bg-[#111111] p-8 transition hover:border-[#C9A84C]/50">
                <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">{f.tag}</div>
                <p className="mt-6 text-base leading-relaxed text-white/80">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Five Layers */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              Four layers. <span className="text-[#C9A84C]">One protocol.</span>
            </h2>
            <Link href="/protocol" className="text-sm text-[#C9A84C] hover:underline">
              Read the architecture →
            </Link>
          </div>
          <div className="mt-16 grid gap-px border border-[#1f1f1f] bg-[#1f1f1f] md:grid-cols-2 lg:grid-cols-4">
            {layers.map((l) => (
              <div key={l.n} className="bg-[#0a0a0a] p-8">
                <div className="font-mono text-xs text-white/40">{l.n}</div>
                <h3 className="mt-2 text-lg font-semibold text-[#C9A84C]">{l.name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{l.desc}</p>
                <div className="mt-6 inline-block border border-[#1f1f1f] px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-white/50">
                  {l.phase}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ecosystem */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            The <span className="text-[#C9A84C]">BigMarkt</span> Ecosystem
          </h2>
          <div className="mt-16 grid gap-6 md:grid-cols-2">
            {ecosystem.map((e) => {
              const external = e.href.startsWith("http");
              const Wrap: React.ElementType = external ? "a" : Link;
              const wrapProps = external
                ? { href: e.href, target: "_blank", rel: "noopener" }
                : { href: e.href };
              return (
                <Wrap
                  key={e.domain}
                  {...wrapProps}
                  className="group block border border-[#1f1f1f] bg-[#111111] p-8 transition hover:border-[#C9A84C]/50"
                >
                  <div className="font-mono text-xs text-white/50">{e.domain}</div>
                  <h3 className="mt-2 text-2xl font-semibold text-white group-hover:text-[#C9A84C]">{e.title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-white/70">{e.desc}</p>
                </Wrap>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
