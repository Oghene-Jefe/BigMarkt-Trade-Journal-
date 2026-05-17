export const metadata = {
  title: "Security Policy | BigMarkt",
  description: "Responsible disclosure policy and reporting guidance for BigMarkt.",
};

const inScope = [
  "https://www.bigmarkt.co",
  "https://journal.bigmarkt.co",
  "https://club.bigmarkt.co",
  "https://fts.bigmarkt.co",
];

const outOfScope = [
  "Denial-of-service, stress, or resource exhaustion testing",
  "Spam, phishing, social engineering, or physical attacks",
  "Accessing, modifying, deleting, or exporting data that is not yours",
  "Automated high-volume scanning",
  "Attacks against third-party providers",
];

const priorityAreas = [
  "Authentication or authorization bypasses",
  "Public profile, leaderboard, or trade privacy failures",
  "Signed URL privacy failures",
  "Broker or exchange ingestion integrity issues",
  "Webhook signature validation issues",
  "Admin privilege escalation",
  "Payment, subscription, or token settlement logic flaws",
];

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-24">
      <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">
        / Security
      </div>
      <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">
        Responsible disclosure
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
        BigMarkt welcomes good-faith vulnerability reports that stay within this policy.
      </p>

      <section className="mt-12 border-t border-[#1f1f1f] pt-10">
        <h2 className="text-2xl font-semibold">Report a vulnerability</h2>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          Email{" "}
          <a className="text-[#C9A84C]" href="mailto:security@bigmarkt.co">
            security@bigmarkt.co
          </a>{" "}
          with the affected URL, steps to reproduce, expected and actual behavior,
          impact, and any minimal proof-of-concept details.
        </p>
      </section>

      <section className="mt-10 border-t border-[#1f1f1f] pt-10">
        <h2 className="text-2xl font-semibold">In scope</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          {inScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border-t border-[#1f1f1f] pt-10">
        <h2 className="text-2xl font-semibold">Out of scope</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          {outOfScope.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="mt-10 border-t border-[#1f1f1f] pt-10">
        <h2 className="text-2xl font-semibold">Safe harbor</h2>
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          We will not pursue legal action for good-faith research that stays in scope,
          avoids privacy harm, avoids service disruption, and gives us reasonable time
          to remediate before public disclosure.
        </p>
      </section>

      <section className="mt-10 border-t border-[#1f1f1f] pt-10">
        <h2 className="text-2xl font-semibold">Priority areas</h2>
        <ul className="mt-4 space-y-2 text-sm text-white/70">
          {priorityAreas.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

