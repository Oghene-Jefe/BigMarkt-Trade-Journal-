import Link from "next/link";

export const metadata = {
  title: "Chapters — BigMarkt Club",
  description: "BigMarkt Club is global. It runs locally. Start a chapter at your campus.",
};

const ops = [
  { title: "Discord First", body: "Each chapter has its own Discord server for daily discussion and community." },
  { title: "WhatsApp for Recruitment", body: "WhatsApp groups are used to recruit and onboard new members on campus." },
  { title: "Chapter Leader", body: "Every chapter is led by a student who owns the community on their campus." },
];

const comingSoon = [
  "University of Lagos",
  "University of Ibadan",
  "Obafemi Awolowo University",
  "Ahmadu Bello University",
  "University of Ghana (Legon)",
  "KNUST Ghana",
  "University of Nairobi",
  "University of Cape Town",
  "University of Rwanda",
  "University of Edinburgh",
  "Howard University USA",
];

const benefits = [
  { title: "For You", body: "Build leadership skills, industry connections and a community that outlasts your degree." },
  { title: "For Your Members", body: "Give your peers access to financial education that is free, practical and community-driven." },
  { title: "For Your Campus", body: "Bring BigMarkt Club to your institution and put your campus on the map." },
];

const requirements = [
  "10 founding members committed",
  "A faculty advisor or staff supporter",
  "Campus approval or recognition",
  "A chapter president ready to lead",
];

const provided = [
  "Chapter setup guide and onboarding",
  "Access to all track materials",
  "Mentorship programme access",
  "BigMarkt Club branding kit",
  "Direct support from the core team",
];

const steps = [
  "Fill in the chapter application form below",
  "We review your application within 7 days",
  "Onboarding call with the BigMarkt Club team",
  "Chapter officially launched with founding members",
];

export default function ChaptersPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            BigMarkt Club is global. <span className="text-[#C9A84C]">It runs locally.</span>
          </h1>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How Chapters Operate</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {ops.map((o) => (
              <div key={o.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-lg font-semibold text-[#C9A84C]">{o.title}</h3>
                <p className="mt-3 text-sm text-white/70">{o.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Our Chapters</h2>
          <div className="mt-12 border border-[#C9A84C] bg-[#111111] p-8">
            <div className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">Pioneer Chapter</div>
            <h3 className="mt-3 text-2xl font-bold text-white">University of Port Harcourt — UNIPORT</h3>
            <p className="mt-2 text-sm text-white/70">Founded 2026 · Status: <span className="text-[#C9A84C]">Active</span></p>
          </div>

          <h3 className="mt-16 text-xs font-semibold uppercase tracking-widest text-white/40">Coming Soon</h3>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {comingSoon.map((c) => (
              <div key={c} className="border border-[#1f1f1f] bg-[#111111] p-4">
                <div className="text-sm text-white/80">{c}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-white/40">Coming Soon</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Why Start a Chapter</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {benefits.map((b) => (
              <div key={b.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-lg font-semibold text-[#C9A84C]">{b.title}</h3>
                <p className="mt-3 text-sm text-white/70">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-[#C9A84C] md:text-3xl">Requirements</h2>
            <ul className="mt-6 space-y-3">
              {requirements.map((r) => (
                <li key={r} className="flex gap-3 text-white/80">
                  <span className="text-[#C9A84C]">✓</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#C9A84C] md:text-3xl">What BigMarkt Club Provides</h2>
            <ul className="mt-6 space-y-3">
              {provided.map((p) => (
                <li key={p} className="flex gap-3 text-white/80">
                  <span className="text-[#C9A84C]">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Application Process</h2>
          <ol className="mt-12 space-y-6">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-6 border border-[#1f1f1f] bg-[#111111] p-6">
                <div className="text-2xl font-bold text-[#C9A84C]">{String(i + 1).padStart(2, "0")}</div>
                <div className="text-white/80">{s}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Ready to lead a chapter?</h2>
          <Link
            href="/join?type=chapter"
            className="mt-8 bg-[#C9A84C] px-8 py-4 text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Apply to Start a Chapter
          </Link>
        </div>
      </section>
    </>
  );
}
