import Link from "next/link";
import { Suspense } from "react";
import StatBar from "../_components/StatBar";

export const metadata = {
  title: "The BigMarkt Ecosystem",
  description:
    "Four properties, one protocol. Journal, Campus Club, Academy, Protocol — and how they feed each other.",
};

const properties = [
  {
    domain: "journal.bigmarkt.co",
    title: "The Journal",
    desc: "Auto-captured trade journal with public leaderboards and verified profiles. The proof layer of the protocol.",
    does: ["Real-time trade capture", "Public leaderboards", "Signed-URL chart privacy", "Public share pages"],
    href: "https://journal.bigmarkt.co",
  },
  {
    domain: "club.bigmarkt.co",
    title: "The Campus Club",
    desc: "University trading community. Cohort-based challenges, peer review, and mentorship from verified leaders.",
    does: ["Campus cohorts", "Group challenges", "Peer review circles", "Pipeline to leaderboard"],
    href: "https://club.bigmarkt.co",
  },
  {
    domain: "fts.bigmarkt.co",
    title: "The Academy",
    desc: "Forex training school. Structured curriculum, certification, and a route from learner to verified trader.",
    does: ["Structured curriculum", "Certification tracks", "Live sessions", "Onramp to Journal"],
    href: "https://fts.bigmarkt.co",
  },
  {
    domain: "bigmarkt.co",
    title: "The Protocol",
    desc: "Where it all connects. Architecture, ecosystem coordination, and governance.",
    does: ["Architecture docs", "Roadmap", "Ecosystem coordination", "Governance"],
    href: "/",
  },
];

const flywheel = [
  { from: "Academy", to: "Club", body: "Graduates enter cohorts to apply training with peers." },
  { from: "Club", to: "Journal", body: "Cohort members journal real trades and climb the leaderboard." },
  { from: "Journal", to: "Protocol", body: "Verified leaders build a reputation from their verified record. Planned for future phases: signal publishing." },
  { from: "Protocol", to: "Academy", body: "Reputation pulls new learners back into the funnel." },
];

export default function EcosystemPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">/ Ecosystem</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
            The <span className="text-[#C9A84C]">BigMarkt</span> Ecosystem
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            Four properties. One protocol. Each surface feeds the others.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2">
            {properties.map((p) => {
              const external = p.href.startsWith("http");
              const Wrap: React.ElementType = external ? "a" : Link;
              const wrapProps = external
                ? { href: p.href, target: "_blank", rel: "noopener" }
                : { href: p.href };
              return (
                <Wrap
                  key={p.domain}
                  {...wrapProps}
                  className="group block border border-[#1f1f1f] bg-[#111111] p-8 transition hover:border-[#C9A84C]/50"
                >
                  <div className="font-mono text-xs text-white/50">{p.domain}</div>
                  <h2 className="mt-2 text-3xl font-semibold text-white group-hover:text-[#C9A84C]">{p.title}</h2>
                  <p className="mt-4 text-sm leading-relaxed text-white/75">{p.desc}</p>
                  <ul className="mt-6 space-y-2">
                    {p.does.map((d) => (
                      <li key={d} className="flex items-start gap-2 text-sm text-white/70">
                        <span className="mt-1.5 inline-block h-1 w-1 flex-shrink-0 bg-[#C9A84C]" />
                        {d}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 text-xs uppercase tracking-widest text-[#C9A84C]">Open →</div>
                </Wrap>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            The <span className="text-[#C9A84C]">flywheel</span>
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/75">
            Each property routes users into the next. The loop compounds.
          </p>

          <div className="mt-12 grid gap-px border border-[#1f1f1f] bg-[#1f1f1f] md:grid-cols-2 lg:grid-cols-4">
            {flywheel.map((s) => (
              <div key={`${s.from}-${s.to}`} className="bg-[#0a0a0a] p-6">
                <div className="font-mono text-xs uppercase tracking-widest text-white/40">
                  {s.from} <span className="text-[#C9A84C]">→</span> {s.to}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-white/75">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Where we are <span className="text-[#C9A84C]">today</span>
          </h2>
          <div className="mt-12">
            <Suspense fallback={<div className="h-24 border border-[#1f1f1f] bg-[#111111]" />}>
              <StatBar />
            </Suspense>
          </div>
        </div>
      </section>
    </>
  );
}
