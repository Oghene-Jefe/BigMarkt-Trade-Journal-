import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — BigMarkt",
  description: "How BigMarkt collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-bg text-white">
      <div className="mx-auto max-w-3xl px-4 py-20">
        <Link href="/" className="text-xs uppercase tracking-[0.25em] text-muted hover:text-white">
          ← Back to home
        </Link>

        <h1 className="mt-8 font-display text-4xl tracking-wider text-gold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: 8 June 2026</p>

        <div className="mt-12 space-y-10 text-white/80">

          <section>
            <h2 className="text-xl font-semibold text-white">Who we are</h2>
            <p className="mt-3 leading-relaxed">
              BigMarkt (&ldquo;we&rdquo;, &ldquo;us&rdquo;) operates bigmarkt.co,
              journal.bigmarkt.co, fts.bigmarkt.co and club.bigmarkt.co. For questions
              about this policy or your data, contact us at{" "}
              <a href="mailto:support@bigmarkt.co" className="text-gold hover:underline">
                support@bigmarkt.co
              </a>
              . BigMarkt is the data controller for the personal data described here.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">What we collect</h2>
            <ul className="mt-3 space-y-2 leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  <strong className="text-white">Account data:</strong> email address and
                  display name when you create an account.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  <strong className="text-white">Trading journal data:</strong> the trades,
                  notes, tags and screenshots you record or that are captured from a broker
                  account you connect.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  <strong className="text-white">Form submissions:</strong> information you
                  provide in sign-up, application, or contact forms (such as name, email, and
                  the answers you give).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  <strong className="text-white">Technical data:</strong> basic usage and
                  device information needed to operate and secure the sites.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Why we use it and our legal basis</h2>
            <ul className="mt-3 space-y-2 leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  To provide your account and the journal service — basis: performance of a
                  contract.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  To respond to applications and enquiries — basis: your consent / our
                  legitimate interest in replying to you.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  To keep the service secure and working — basis: our legitimate interest.
                </span>
              </li>
            </ul>
            <p className="mt-4 leading-relaxed">
              We do not sell your personal data, and we do not use it for automated decisions
              that produce legal effects about you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">
              Where your data is stored and who processes it
            </h2>
            <p className="mt-3 leading-relaxed">
              We use trusted third-party providers to run BigMarkt on our behalf. They fall
              into these categories:
            </p>
            <ul className="mt-3 space-y-2 leading-relaxed">
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  <strong className="text-white">Hosting and infrastructure providers</strong>{" "}
                  — to run our websites and deliver content.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
                <span>
                  <strong className="text-white">Database, authentication and storage providers</strong>{" "}
                  — to securely store your account and journal data, hosted within the
                  European Union (Ireland).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-1 text-gold">•</span>
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
              <a href="mailto:support@bigmarkt.co" className="text-gold hover:underline">
                support@bigmarkt.co
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">How long we keep it</h2>
            <p className="mt-3 leading-relaxed">
              We keep account and journal data for as long as your account is active. If you
              ask us to delete your account, we remove your personal data from our systems,
              except where we must retain limited information to meet a legal obligation. Form
              submissions from people who do not create an account are kept only as long as
              needed to handle the request.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Your rights</h2>
            <p className="mt-3 leading-relaxed">
              Under applicable data protection law (the GDPR) you have the right to access,
              correct, delete, or receive a copy of your personal data, to object to or restrict
              certain processing, and to withdraw consent at any time. To exercise any of these,
              email{" "}
              <a href="mailto:support@bigmarkt.co" className="text-gold hover:underline">
                support@bigmarkt.co
              </a>
              .
            </p>
            <p className="mt-3 leading-relaxed">
              You also have the right to lodge a complaint with your local data protection
              authority.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Cookies</h2>
            <p className="mt-3 leading-relaxed">
              We use only the cookies necessary to keep you signed in and to operate the
              sites. If we add analytics or other non-essential cookies in future, we will ask
              for your consent first and update this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Children</h2>
            <p className="mt-3 leading-relaxed">
              Our services are not directed at anyone under 18, and we do not knowingly
              collect data from children.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Changes</h2>
            <p className="mt-3 leading-relaxed">
              We may update this policy. The &ldquo;Last updated&rdquo; date above shows the
              latest version, and material changes will be made clear on our sites.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Contact</h2>
            <p className="mt-3 leading-relaxed">
              <a href="mailto:support@bigmarkt.co" className="text-gold hover:underline">
                support@bigmarkt.co
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
