import { Suspense } from "react";
import ApplicationForm from "../_components/ApplicationForm";

export const metadata = {
  title: "Join — BigMarkt Club",
  description: "Free to join. No credit card. No catch. Apply to BigMarkt Club today.",
  alternates: { canonical: "/join" },
};

const tiers = [
  {
    name: "Explorer",
    price: "Free",
    status: "Open",
    perks: [
      "Access to the BigMarkt Club community",
      "Tracks overview and previews",
      "Announcements and event invites",
    ],
  },
  {
    name: "Builder",
    price: "Free — Founding Phase",
    status: "Founding Members Only",
    perks: [
      "Full access to all six learning tracks",
      "Assignments and feedback",
      "Mentorship matching with industry pros",
      "Discord and community channels",
    ],
  },
  {
    name: "Leader",
    price: "Merit Only",
    status: "By Selection",
    perks: [
      "Chapter leadership opportunities",
      "Direct industry connections",
      "Speaking and ambassador roles",
    ],
  },
];

export default function JoinPage() {
  return (
    <>
      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight md:text-6xl">
            Free to join. <span className="text-[#C9A84C]">No credit card. No catch.</span>
          </h1>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-3">
            {tiers.map((t) => (
              <div key={t.name} className="border border-[#1f1f1f] bg-[#111111] p-6">
                <h3 className="text-xl font-semibold text-[#C9A84C]">{t.name}</h3>
                <p className="mt-1 text-xs uppercase tracking-widest text-white/40">{t.price}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-[#C9A84C]">{t.status}</p>
                <ul className="mt-6 space-y-3">
                  {t.perks.map((p) => (
                    <li key={p} className="flex gap-3 text-sm text-white/80">
                      <span className="text-[#C9A84C]">✓</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[#1f1f1f] px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Apply Now</h2>
          <p className="mt-3 text-white/60">It takes less than 3 minutes.</p>
          <div className="mt-12">
            <Suspense fallback={<div className="text-white/60">Loading form…</div>}>
              <ApplicationForm />
            </Suspense>
          </div>
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="border border-[#1f1f1f] bg-[#111111] p-8">
            <h3 className="text-xl font-semibold text-[#C9A84C]">Founding Member Scholarship</h3>
            <p className="mt-4 text-white/80">
              BigMarkt Club is free. If paid tiers are ever introduced, founding members will be
              grandfathered in at the original rate.
            </p>
          </div>
          <p className="mt-8 text-center text-sm text-white/40">
            When we introduce paid tiers, founding members will be grandfathered in at the original rate.
          </p>
        </div>
      </section>
    </>
  );
}
