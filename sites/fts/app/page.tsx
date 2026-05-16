import Link from "next/link";
import { GraduationCap, Megaphone, Swords } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import ApplicationForm from "./_components/ApplicationForm";

type Pathway = {
  icon: LucideIcon;
  title: string;
  body: string;
  cta: string;
  href: string;
  external: boolean;
};

const pillars = [
  { title: "Market Structure & Technical Analysis", body: "Read charts. Understand price. Trade with the trend." },
  { title: "Forex Fundamentals", body: "Understand what moves the market and why." },
  { title: "Risk Management", body: "Protect your capital first. Every single trade." },
  { title: "Trading Psychology", body: "Your mindset determines your results." },
  { title: "Trade Journaling", body: "If you do not track it, you cannot improve it." },
  { title: "Live Trading & Strategy", body: "Apply everything in real market conditions." },
];

const pathways: Pathway[] = [
  {
    icon: Megaphone,
    title: "FTS Channel",
    body: "Follow for market updates, trade ideas and community announcements.",
    cta: "Join Channel",
    href: "https://t.me/fts_bigmarkt",
    external: true,
  },
  {
    icon: GraduationCap,
    title: "Boot Camp",
    body: "Structured 13-module forex education programme. Pioneer cohort now forming.",
    cta: "Apply Now",
    href: "#apply",
    external: false,
  },
  {
    icon: Swords,
    title: "War Room",
    body: "Live trading sessions for active traders. Graduates only.",
    cta: "Learn More",
    href: "/warroom",
    external: false,
  },
];

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden border-b border-[#1f1f1f]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(201,168,76,0.08),_transparent_60%)]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-6 py-24">
          <div className="mb-6 inline-flex items-center self-start gap-2 border border-[#1f1f1f] bg-[#111111] px-3 py-1 text-xs uppercase tracking-widest text-[#C9A84C]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C9A84C]" />
            FTS — Free Trading Academy
          </div>
          <h1 className="font-bold leading-[1.05] tracking-tight text-4xl md:text-6xl lg:text-7xl">
            <span className="block text-[#C9A84C]">Free Trading Academy</span>
          </h1>
          <p className="mt-8 max-w-2xl text-base text-white/70 md:text-lg">
            Learn to trade properly. No hype. No expensive courses. A growing community of traders building real skills.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <a
              href="#apply"
              className="bg-[#C9A84C] px-6 py-3 text-center text-sm font-semibold text-black transition hover:bg-[#d8b955]"
            >
              Apply for Boot Camp
            </a>
            <a
              href="https://t.me/fts_bigmarkt"
              target="_blank"
              rel="noopener"
              className="border border-[#C9A84C] px-6 py-3 text-center text-sm font-semibold text-[#C9A84C] transition hover:bg-[#C9A84C] hover:text-black"
            >
              Join FTS Channel
            </a>
          </div>
        </div>
      </section>

      {/* Curriculum */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">The Curriculum</h2>
          <p className="mt-3 text-white/60">What we teach. End to end.</p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p, i) => (
              <div key={p.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <div className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{p.title}</h3>
                <p className="mt-2 text-sm text-white/70">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pathways */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Choose Your Path</h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {pathways.map((p) => {
              const Icon = p.icon;
              return (
              <div key={p.title} className="flex flex-col border border-[#1f1f1f] bg-[#111111] p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C]">
                  <Icon size={20} aria-hidden strokeWidth={1.75} />
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">{p.title}</h3>
                <p className="mt-2 flex-1 text-sm text-white/70">{p.body}</p>
                {p.external ? (
                  <a
                    href={p.href}
                    target="_blank"
                    rel="noopener"
                    className="mt-6 inline-block bg-[#C9A84C] px-5 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-[#d8b955]"
                  >
                    {p.cta}
                  </a>
                ) : (
                  <Link
                    href={p.href}
                    className="mt-6 inline-block bg-[#C9A84C] px-5 py-2.5 text-center text-sm font-semibold text-black transition hover:bg-[#d8b955]"
                  >
                    {p.cta}
                  </Link>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BigMarkt Connection */}
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Learn here. <span className="text-[#C9A84C]">Prove it there.</span>
          </h2>
          <p className="mt-6 text-white/70 md:text-lg">
            Boot Camp teaches trade journaling in Module 9. When you are ready to trade publicly, journal.bigmarkt.co is where your verified record lives. Your journal is your reputation.
          </p>
          <a
            href="https://journal.bigmarkt.co/signup"
            target="_blank"
            rel="noopener"
            className="mt-8 inline-block bg-[#C9A84C] px-6 py-3 text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Start Your Journal
          </a>
        </div>
      </section>

      {/* Application */}
      <section id="apply" className="scroll-mt-20 px-6 py-24">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Apply for Boot Camp — <span className="text-[#C9A84C]">Pioneer Cohort</span>
          </h2>
          <p className="mt-3 text-white/60">
            The pioneer cohort is now forming. Fill in your details and we will be in touch.
          </p>
          <div className="mt-10">
            <ApplicationForm />
          </div>
        </div>
      </section>
    </>
  );
}
