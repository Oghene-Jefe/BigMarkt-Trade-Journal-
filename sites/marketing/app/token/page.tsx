import EmailCapture from "./_components/EmailCapture";

export const metadata = {
  title: "$BMT — The Settlement Rail | BigMarkt",
  description:
    "BMT is the utility settlement token for the BigMarkt protocol. Solana-based. Powers leader staking, copy vaults, performance settlement, governance.",
};

const useCases = [
  { tag: "Leader Staking", body: "Verified leaders stake $BMT to publish signals. Stake size gates tier and visibility." },
  { tag: "Follower Copy Vaults", body: "Followers deposit into copy vaults. Performance fees settle in $BMT." },
  { tag: "Performance Settlement", body: "Leader payouts and subscription fees route through $BMT under the hood." },
  { tag: "Tier Upgrades", body: "Premium leader and follower tiers are unlocked by staking $BMT." },
  { tag: "Governance", body: "$BMT holders vote on protocol parameters: fee splits, slashing, tier gates." },
  { tag: "Leaderboard Boost", body: "Stake $BMT to boost leaderboard visibility once minimum performance thresholds are met." },
  { tag: "Journal Premium", body: "Advanced analytics, deeper history, and priority support unlocked via $BMT." },
  { tag: "Dispute Staking", body: "Arbiters stake $BMT to resolve disputes. Bad-faith arbiters are slashed." },
];

const flow = [
  { n: "1", title: "User pays in USDT", body: "Followers and leaders top up familiar USDT — no token mechanics required." },
  { n: "2", title: "Protocol routes USDT → $BMT", body: "Under the hood, the settlement layer swaps USDT for $BMT on Solana." },
  { n: "3", title: "Action settles in $BMT", body: "Subscription, copy fee, stake, or governance action is paid in $BMT." },
  { n: "4", title: "Recipient receives USDT", body: "Leader payouts and refunds route $BMT → USDT before withdrawal." },
];

export default function TokenPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">/ Token</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
            <span className="text-[#C9A84C]">$BMT</span> — The Settlement Rail
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
            $BMT is the utility token that powers BigMarkt&apos;s settlement layer. A rail, not a denomination — users pay in USDT, the protocol routes the rest.
          </p>

          <div className="mt-12 grid gap-px border border-[#1f1f1f] bg-[#1f1f1f] sm:grid-cols-3">
            <div className="bg-[#0a0a0a] p-6">
              <div className="text-xs uppercase tracking-widest text-white/50">Type</div>
              <div className="mt-2 font-mono text-lg text-[#C9A84C]">Utility</div>
            </div>
            <div className="bg-[#0a0a0a] p-6">
              <div className="text-xs uppercase tracking-widest text-white/50">Role</div>
              <div className="mt-2 font-mono text-lg text-[#C9A84C]">Settlement Rail</div>
            </div>
            <div className="bg-[#0a0a0a] p-6">
              <div className="text-xs uppercase tracking-widest text-white/50">Network</div>
              <div className="mt-2 font-mono text-lg text-[#C9A84C]">Solana</div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
              Eight <span className="text-[#C9A84C]">use cases</span>
            </h2>
            <span className="rounded border border-[#C9A84C]/40 px-3 py-1 font-mono text-xs uppercase tracking-widest text-[#C9A84C]/70">
              Future phase · Planned
            </span>
          </div>
          <p className="mt-4 text-sm text-white/50">
            These features are planned for future phases of the protocol and are not yet available.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((u) => (
              <div key={u.tag} className="border border-[#1f1f1f] bg-[#111111] p-6 transition hover:border-[#C9A84C]/50">
                <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">{u.tag}</div>
                <p className="mt-4 text-sm leading-relaxed text-white/75">{u.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            Settlement <span className="text-[#C9A84C]">flow</span>
          </h2>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-white/75">
            Users never need to hold $BMT directly. USDT goes in. USDT comes out. $BMT moves between.
          </p>

          <ol className="mt-12 space-y-px border border-[#1f1f1f] bg-[#1f1f1f]">
            {flow.map((f) => (
              <li key={f.n} className="grid gap-2 bg-[#0a0a0a] p-6 md:grid-cols-[80px_1fr] md:items-start md:gap-6">
                <div className="font-mono text-3xl text-[#C9A84C]">{f.n}</div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/70">{f.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-5xl">
            <span className="text-[#C9A84C]">Tokenomics</span>
          </h2>
          <div className="mt-8 border border-[#1f1f1f] bg-[#111111] p-8">
            <p className="text-base leading-relaxed text-white/80">
              Full tokenomics — supply, allocation, vesting, emission schedule, and treasury policy — will be published at Phase 4 launch.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            Notify me at <span className="text-[#C9A84C]">token launch</span>
          </h2>
          <p className="mt-4 text-sm text-white/60">No spam. One email when $BMT goes live.</p>
          <div className="mt-8 text-left">
            <EmailCapture />
          </div>
        </div>
      </section>
    </>
  );
}
