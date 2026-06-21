import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — BigMarkt",
  description: "How BigMarkt collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="font-mono text-xs uppercase tracking-widest text-[#C9A84C]">/ Legal</div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-6xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-white/60">Last updated: 8 June 2026</p>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-3xl space-y-14 text-white/80">

          <div>
            <h2 className="text-2xl font-bold text-white">Who we are</h2>
            <p className="mt-4 leading-relaxed">
              BigMarkt (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates bigmarkt.co,
              journal.bigmarkt.co, fts.bigmarkt.co and club.bigmarkt.co. For questions about
              this policy or your data, contact us at{" "}
              <a href="mailto:support@bigmarkt.co" className="text-[#C9A84C] hover:underline">
                support@bigmarkt.co
              </a>
              . BigMarkt is the data controller for the personal data described here.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">What we collect</h2>
            <ul className="mt-4 space-y-3 leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  <strong className="text-white">Account data:</strong> email address and
                  display name when you create an account.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  <strong className="text-white">Trading journal data:</strong> the trades,
                  notes, tags and screenshots you record or that are captured from a broker
                  account you connect.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  <strong className="text-white">Form submissions:</strong> information you
                  provide in sign-up, application, or contact forms (such as name, email, and
                  the answers you give).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  <strong className="text-white">Technical data:</strong> basic usage and
                  device information needed to operate and secure the sites.
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Why we use it and our legal basis</h2>
            <ul className="mt-4 space-y-3 leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  To provide your account and the journal service — basis: performance of a
                  contract.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  To respond to applications and enquiries — basis: your consent / our
                  legitimate interest in replying to you.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  To keep the service secure and working — basis: our legitimate interest.
                </span>
              </li>
            </ul>
            <p className="mt-4 leading-relaxed">
              We do not sell your personal data, and we do not use it for automated decisions
              that produce legal effects about you.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">
              Where your data is stored and who processes it
            </h2>
            <p className="mt-4 leading-relaxed">
              We use trusted third-party providers to run BigMarkt on our behalf. They fall
              into these categories:
            </p>
            <ul className="mt-4 space-y-3 leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  <strong className="text-white">Hosting and infrastructure providers</strong>{" "}
                  — to run our websites and deliver content.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  <strong className="text-white">Database, authentication and storage providers</strong>{" "}
                  — to securely store your account and journal data, hosted within the
                  European Union (Ireland).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-[#C9A84C]">—</span>
                <span>
                  <strong className="text-white">Email and communication providers</strong>{" "}
                  — to handle messages you send us.
                </span>
              </li>
            </ul>
            <p className="mt-4 leading-relaxed">
              We share only what each provider needs to do its job and require them to protect
              your data. Where data is processed outside the UK/EEA, the transfer is covered
              by appropriate safeguards such as Standard Contractual Clauses. A current list
              of the specific providers we use is available on request at{" "}
              <a href="mailto:support@bigmarkt.co" className="text-[#C9A84C] hover:underline">
                support@bigmarkt.co
              </a>
              .
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">How long we keep it</h2>
            <p className="mt-4 leading-relaxed">
              We keep account and journal data for as long as your account is active. If you
              ask us to delete your account, we remove your personal data from our systems,
              except where we must retain limited information to meet a legal obligation. Form
              submissions from people who do not create an account are kept only as long as
              needed to handle the request.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Your rights</h2>
            <p className="mt-4 leading-relaxed">
              Under applicable data protection law (the GDPR) you have the right to access,
              correct, delete, or receive a copy of your personal data, to object to or restrict
              certain processing, and to withdraw consent at any time. To exercise any of these,
              email{" "}
              <a href="mailto:support@bigmarkt.co" className="text-[#C9A84C] hover:underline">
                support@bigmarkt.co
              </a>
              .
            </p>
            <p className="mt-4 leading-relaxed">
              You also have the right to lodge a complaint with your local data protection
              authority.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Cookies</h2>
            <p className="mt-4 leading-relaxed">
              We use only the cookies necessary to keep you signed in and to operate the
              sites. If we add analytics or other non-essential cookies in future, we will ask
              for your consent first and update this policy.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Children</h2>
            <p className="mt-4 leading-relaxed">
              Our services are not directed at anyone under 18, and we do not knowingly
              collect data from children.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Changes</h2>
            <p className="mt-4 leading-relaxed">
              We may update this policy. The &ldquo;Last updated&rdquo; date above shows the
              latest version, and material changes will be made clear on our sites.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">Contact</h2>
            <p className="mt-4 leading-relaxed">
              <a href="mailto:support@bigmarkt.co" className="text-[#C9A84C] hover:underline">
                support@bigmarkt.co
              </a>
            </p>
          </div>

        </div>

        <div className="mx-auto mt-16 max-w-3xl">
          <Link href="/" className="text-sm text-white/60 hover:text-[#C9A84C]">
            ← Back to home
          </Link>
        </div>
      </section>
    </>
  );
}
