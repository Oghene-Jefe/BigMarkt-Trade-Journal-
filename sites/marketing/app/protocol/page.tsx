export const metadata = {
  title: "Architecture",
  description:
    "How BigMarkt verifies trades: a read-only journal as the source of truth, public reputation built on proof, and accountability through the Trading Constitution.",
  alternates: { canonical: "/protocol" },
  openGraph: {
    title: "BigMarkt Architecture",
    description:
      "How BigMarkt verifies trades: a read-only journal as the source of truth, public reputation built on proof, and accountability through the Trading Constitution.",
    url: "https://www.bigmarkt.co/protocol",
  },
};

const layers = [
  {
    n: "01",
    name: "Proof Layer",
    summary: "Server-captured trade history.",
    detail:
      "A read-only Expert Advisor for MetaTrader 4 and 5 reads every fill from the trader's broker terminal and ships it to the journal in real time. Trades arrive timestamped server-side, with no manual edit path, no screenshot upload, and no after-the-fact rewrite. The journal entry is what the broker confirmed — nothing else.",
  },
  {
    n: "02",
    name: "Coordination Layer",
    summary: "Public leaderboards and verified rank.",
    detail:
      "Sanitized aggregate stats — win rate, expectancy, drawdown, R-multiple — are published per profile. Anyone can see a rank-ordered view of who is actually performing, with no email leakage and no self-reported numbers. Rank is downstream of proof.",
  },
  {
    n: "03",
    name: "Accountability Layer",
    summary: "The Trading Constitution.",
    detail:
      "Each trader writes their own rules — risk caps, stop-loss discipline, instrument limits, minimum R:R. The journal checks every verified trade against those rules and publishes an adherence score. Reputation here isn't only how much you made; it's whether you followed the rules you set for yourself.",
  },
  {
    n: "04",
    name: "Community Layer",
    summary: "A community-owned reputation network (planned).",
    detail:
      "Where this is headed: a verified track record that's portable and owned by the trader, not locked inside one broker or platform. This is a long-term direction, not a shipped feature — built only on verified history, and only once the foundation beneath it is proven.",
  },
];

export default function ProtocolPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">/ Architecture</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
            The BigMarkt <span className="text-[#C9A84C]">Architecture</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            BigMarkt is built in layers. Each layer is independently verifiable, and each is downstream of the one beneath it.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl space-y-16">
          {layers.map((l) => (
            <div key={l.n} className="grid gap-6 md:grid-cols-[120px_1fr]">
              <div>
                <div className="font-mono text-4xl text-[#C9A84C]">{l.n}</div>
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white md:text-3xl">{l.name}</h2>
                <p className="mt-2 text-sm uppercase tracking-widest text-[#C9A84C]/80">{l.summary}</p>
                <p className="mt-6 text-base leading-relaxed text-white/75">{l.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            How verification <span className="text-[#C9A84C]">works</span>
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/75">
            The journal is the source of truth. Every entry traces back to a broker fill — not a screenshot, not a claim.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { step: "1", title: "Broker fills the trade", body: "The trader's read-only EA captures the fill the moment it happens on their terminal." },
              { step: "2", title: "Journal records it", body: "The fill is written to the journal server-side — timestamped, core fields locked, with no manual edit path." },
              { step: "3", title: "Reputation updates", body: "Public stats, leaderboard rank, and Constitution adherence recompute from that verified record." },
            ].map((s) => (
              <div key={s.step} className="border border-[#1f1f1f] bg-[#111111] p-8">
                <div className="font-mono text-xs text-white/60">STEP {s.step}</div>
                <h3 className="mt-2 text-lg font-semibold text-[#C9A84C]">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{s.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 max-w-3xl text-sm leading-relaxed text-white/60">
            BigMarkt never holds broker credentials, never routes orders, and never places trades. It reads what the broker confirms and records it. Information moves; orders don&apos;t.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Broker <span className="text-[#C9A84C]">compatibility</span>
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/75">
            BigMarkt ships an Expert Advisor for MetaTrader 4 and MetaTrader 5. Most regulated retail FX/CFD brokers are supported out of the box. cTrader and broker-API integrations are on the roadmap.
          </p>
          <a
            href="https://journal.bigmarkt.co/brokers"
            target="_blank"
            rel="noopener"
            className="mt-8 inline-block border border-[#C9A84C] px-6 py-3 text-sm font-semibold uppercase tracking-wider text-[#C9A84C] transition hover:bg-[#C9A84C]/10"
          >
            View supported brokers →
          </a>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            What BigMarkt <span className="text-[#C9A84C]">is</span>
          </h2>
          <div className="mt-8 border-l-2 border-[#C9A84C] bg-[#111111] p-8">
            <p className="text-lg italic leading-relaxed text-white/90">
              &ldquo;The journal entry is a record of what happened — verified, not self-reported.&rdquo;
            </p>
          </div>
          <p className="mt-8 max-w-3xl text-base leading-relaxed text-white/75">
            BigMarkt is a journaling and verification tool. The EA is read-only: it reads your trade history and never places, modifies, or closes a position. Nothing here is investment advice, and BigMarkt does not advise, manage funds, or trade on anyone&apos;s behalf.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/75">
            That boundary is deliberate. BigMarkt&apos;s job is to make a trading record impossible to fake — and to leave every trading decision with the trader.
          </p>
        </div>
      </section>
    </>
  );
}
