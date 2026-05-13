export const metadata = {
  title: "About — BigMarkt Club",
  description: "Why BigMarkt Club exists, the link to BigMarkt, and the team behind it.",
};

const mvv = [
  { title: "Mission", body: "Make financial education free, practical and community-driven for every student in Africa and beyond." },
  { title: "Vision", body: "A generation of financially literate young Africans leading global markets." },
  { title: "Values", body: "Honesty. Discipline. Community. Continuous learning." },
];

const team = [
  {
    initials: "JS",
    name: "Jefe S.",
    role: "Founder & Trading Principal",
    body: "Full-time trader, educator and founder of FTS Free Trading Academy. Convener of the BigMarkt Protocol.",
  },
  {
    initials: "NO",
    name: "Nelson O.",
    role: "Senior Analyst & Co-Trader",
    body: "Senior market analyst and co-trader at BigMarkt. Supports the educational framework and member mentorship.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            BigMarkt Club exists because financial education is broken. <span className="text-[#C9A84C]">We are fixing it.</span>
          </h1>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-[#C9A84C] md:text-3xl">Who We Are</h2>
            <p className="mt-6 text-white/80">
              BigMarkt Club is the student financial education arm of the BigMarkt ecosystem.
              We bring together students across Africa and beyond who want real financial skills
              — not just theory.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[#C9A84C] md:text-3xl">The Link to BigMarkt</h2>
            <p className="mt-6 text-white/80">
              BigMarkt is building the world&rsquo;s first community-owned trading reputation
              protocol. The Club is where the next generation of traders and investors get
              their foundation. When you are ready to trade publicly, journal.bigmarkt.co is
              your verified record.
            </p>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            {mvv.map((m) => (
              <div key={m.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-xl font-semibold text-[#C9A84C]">{m.title}</h3>
                <p className="mt-4 text-sm text-white/70">{m.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">The Team</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {team.map((p) => (
              <div key={p.name} className="border border-[#1f1f1f] bg-[#111111] p-8">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C9A84C] text-lg font-bold text-black">
                  {p.initials}
                </div>
                <h3 className="mt-6 text-xl font-semibold text-white">{p.name}</h3>
                <p className="text-sm font-semibold text-[#C9A84C]">{p.role}</p>
                <p className="mt-4 text-sm text-white/70">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            African Roots. <span className="text-[#C9A84C]">Global Reach.</span>
          </h2>
          <p className="mx-auto mt-8 max-w-3xl text-white/80 md:text-lg">
            BigMarkt Club was built in Africa, for Africa — and for every student anywhere who
            has been left out of financial education. We are proving that where you start does
            not determine where you finish.
          </p>
        </div>
      </section>
    </>
  );
}
