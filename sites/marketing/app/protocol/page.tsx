import Link from "next/link";

export const metadata = {
  title: "The Protocol Architecture — BigMarkt",
  description:
    "Five layers explained: proof, coordination, signal, settlement, protocol. The journal-to-journal architecture.",
};

const layers = [
  {
    n: "01",
    name: "Proof Layer",
    summary: "Server-captured trade history.",
    detail:
      "The MT4/MT5 Expert Advisor reads every fill from the trader's broker terminal and ships it to the journal in real time. Trades arrive timestamped server-side, with no manual edit path, no screenshot upload, and no after-the-fact rewrite. The journal entry is what the broker confirmed.",
  },
  {
    n: "02",
    name: "Coordination Layer",
    summary: "Public leaderboards and verified rank.",
    detail:
      "Sanitized aggregate stats (win rate, expectancy, drawdown, R-multiple) are published per profile. Anonymous visitors get a rank-ordered view of who is actually performing, with no email leakage and no self-reported numbers. Rank is downstream of proof.",
  },
  {
    n: "03",
    name: "Signal Layer",
    summary: "Journal-to-journal information flow.",
    detail:
      "Followers subscribe to verified leaders. When a leader's EA writes a trade to their journal, a sanitized signal record is delivered to each follower's journal as an information event — pair, direction, entry, stop, target, timestamp. The follower's terminal does not auto-execute; the signal is data, not a command.",
  },
  {
    n: "04",
    name: "Settlement Layer",
    summary: "$BMT-routed payment rail (planned).",
    detail:
      "Planned for a later phase. Subscriptions, leader payouts, copy-vault performance fees, and dispute stakes will settle through $BMT on Solana. Users will top up in USDT, with the protocol routing USDT → $BMT → USDT under the hood so leaders and followers never need to think about token mechanics.",
  },
  {
    n: "05",
    name: "Protocol Layer",
    summary: "On-chain reputation and governance (planned).",
    detail:
      "Planned for a later phase. A trader's verified history becomes portable and cryptographically attestable. Disputes are resolved by staked arbiters. Protocol parameters — fee splits, slashing thresholds, leader tier gates — are governed by $BMT holders.",
  },
];

export default function ProtocolPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">/ Architecture</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
            The Protocol <span className="text-[#C9A84C]">Architecture</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            BigMarkt is five layers stacked. Each layer is independently verifiable, and each is downstream of the one beneath it.
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
            Journal-to-journal <span className="text-[#C9A84C]">architecture</span>
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/75">
            A signal does not flow from one broker to another. It flows from one journal to another.
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              { step: "1", title: "Leader trades", body: "Leader's EA captures the fill and writes it to their journal." },
              { step: "2", title: "Journal emits signal", body: "The journal publishes a sanitized signal record to each subscribed follower's journal." },
              { step: "3", title: "Follower receives", body: "The signal appears in the follower's journal as an information event. Execution remains the follower's choice." },
            ].map((s) => (
              <div key={s.step} className="border border-[#1f1f1f] bg-[#111111] p-8">
                <div className="font-mono text-xs text-white/40">STEP {s.step}</div>
                <h3 className="mt-2 text-lg font-semibold text-[#C9A84C]">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">{s.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-12 max-w-3xl text-sm leading-relaxed text-white/60">
            This architecture means the protocol never holds broker credentials, never routes orders, and never sits between a trader and their counterparty. Information moves; orders don&apos;t.
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
            Legal <span className="text-[#C9A84C]">architecture</span>
          </h2>
          <div className="mt-8 border-l-2 border-[#C9A84C] bg-[#111111] p-8">
            <p className="text-lg italic leading-relaxed text-white/90">
              &ldquo;The journal entry is information, not a command.&rdquo;
            </p>
          </div>
          <p className="mt-8 max-w-3xl text-base leading-relaxed text-white/75">
            BigMarkt does not advise, manage funds, or place orders. Every signal that flows from a leader&apos;s journal to a follower&apos;s journal is a record of what happened — a published fact. Whether and how a follower acts on that fact is the follower&apos;s decision, executed by the follower, on the follower&apos;s own account.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/75">
            This separation is intentional. It keeps the protocol a transparency tool, not a portfolio manager — which is what regulators distinguish, and what we are building toward as Phase 3 copy execution arrives.
          </p>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <Link
            href="/token"
            className="inline-block border border-[#C9A84C] px-8 py-4 text-sm font-semibold uppercase tracking-wider text-[#C9A84C] transition hover:bg-[#C9A84C]/10"
          >
            Next: $BMT, the settlement rail →
          </Link>
        </div>
      </section>
    </>
  );
}
