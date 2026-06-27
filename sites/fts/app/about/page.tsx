export const metadata = {
  title: "About — FTS Free Trading Academy",
  description: "The education arm of the BigMarkt ecosystem.",
  alternates: { canonical: "/about" },
};

const values = [
  { title: "Free Forever", body: "Core education is and will always be free." },
  { title: "Honest", body: "We do not promise profits. We teach process." },
  { title: "Community", body: "Learning together is better than learning alone." },
];

const ecosystem = [
  { domain: "bigmarkt.co", title: "The Protocol", body: "Architecture, token, ecosystem.", href: "https://bigmarkt.co" },
  { domain: "journal.bigmarkt.co", title: "The Journal", body: "The verified trading journal.", href: "https://journal.bigmarkt.co" },
  { domain: "fts.bigmarkt.co", title: "The Academy", body: "Free forex training and Boot Camp.", href: "https://fts.bigmarkt.co" },
  { domain: "club.bigmarkt.co", title: "The Campus Club", body: "University trading community.", href: "https://club.bigmarkt.co" },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            About <span className="text-[#C9A84C]">Free Trading Academy</span>
          </h1>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-4xl space-y-6 text-white/80 md:text-lg">
          <p>
            Free Trading Academy — FTS — was built on a simple belief: serious trading education should be free and accessible to everyone. We are a growing community of traders across Africa and beyond, learning together and building real skills in the financial markets.
          </p>
          <p>
            FTS is the education arm of the BigMarkt ecosystem. We teach the craft here. BigMarkt Journal is where you build your verified public trading record.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">What we stand for</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {values.map((v) => (
              <div key={v.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-lg font-semibold text-[#C9A84C]">{v.title}</h3>
                <p className="mt-2 text-sm text-white/70">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">The BigMarkt Ecosystem</h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ecosystem.map((e) => (
              <a
                key={e.domain}
                href={e.href}
                target="_blank"
                rel="noopener"
                className="block border border-[#1f1f1f] bg-[#111111] p-6 transition hover:border-[#C9A84C]"
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">{e.domain}</div>
                <h3 className="mt-3 text-lg font-semibold text-white">{e.title}</h3>
                <p className="mt-2 text-sm text-white/70">{e.body}</p>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl border border-[#1f1f1f] bg-[#111111] p-8">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">Lead Contributor</h3>
          <p className="mt-4 text-white/80">
            FTS is led by Jefe S., a full-time trader and educator focused on building financial literacy across Africa and beyond. The community is the product.
          </p>
        </div>
      </section>
    </>
  );
}
