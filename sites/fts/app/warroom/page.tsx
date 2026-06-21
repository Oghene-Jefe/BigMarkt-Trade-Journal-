export const metadata = {
  title: "The War Room — FTS Free Trading Academy",
  description: "Live trading sessions for serious traders. Real markets. Real decisions.",
  alternates: { canonical: "/warroom" },
};

const happenings = [
  { title: "Live Trade Calls", body: "Real-time trade setups shared during active market sessions." },
  { title: "Chart Analysis", body: "Live chart reading and market structure breakdown." },
  { title: "Member Reviews", body: "Trade reviews, feedback on your journal entries, performance discussion." },
];

const requirements = [
  "You have completed FTS Boot Camp or have equivalent experience",
  "You are actively trading a live or demo account",
  "You maintain a trade journal consistently",
];

export default function WarRoomPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            The <span className="text-[#C9A84C]">War Room</span>
          </h1>
          <p className="mt-6 max-w-2xl text-white/70 md:text-lg">
            Live trading sessions for serious traders. Real markets. Real decisions.
          </p>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">What happens</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {happenings.map((h) => (
              <div key={h.title} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-lg font-semibold text-[#C9A84C]">{h.title}</h3>
                <p className="mt-2 text-sm text-white/70">{h.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Is the War Room for you?</h2>
          <ul className="mt-10 space-y-4">
            {requirements.map((r) => (
              <li key={r} className="flex gap-4 border border-[#1f1f1f] bg-[#111111] p-5">
                <span className="text-[#C9A84C]">✓</span>
                <span className="text-white/80">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">How to Get In</h2>
          <p className="mt-6 text-white/70 md:text-lg">
            The War Room is for graduates of FTS Boot Camp and experienced traders who demonstrate consistent journaling and risk discipline.
          </p>
          <a
            href="https://t.me/ftswarroom"
            target="_blank"
            rel="noopener"
            className="mt-10 inline-block bg-[#C9A84C] px-8 py-4 text-sm font-semibold text-black transition hover:bg-[#d8b955]"
          >
            Join War Room on Telegram
          </a>
        </div>
      </section>
    </>
  );
}
