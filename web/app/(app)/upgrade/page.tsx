import { supabaseServer } from "@/lib/supabase/server";
import { getUserPlan } from "@/lib/plan";
import { fmtDate } from "@/lib/format";
import { PageHeader, Section, MetricCard } from "@/components/ui";
import { UpgradeWaitlistForm, LeaveWaitlistForm } from "./UpgradeWaitlistForm";

export const dynamic = "force-dynamic";

const PRO_FEATURES = [
  "Always-on broker-verified ingestion (no need to keep MT5 open)",
  "Multiple connected broker accounts",
  "Unlimited trade history",
  "CSV + PDF export",
  "Public Verified Leader profile",
  "Advanced analytics",
];

export default async function UpgradePage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  const [plan, profileRes] = await Promise.all([
    getUserPlan(),
    sb
      .from("profiles")
      .select("pro_interest_at")
      .eq("id", user!.id)
      .maybeSingle(),
  ]);

  const proInterestAt = (profileRes.data?.pro_interest_at as string | null) ?? null;

  return (
    <div>
      <PageHeader
        title="BigMarkt Pro"
        description="Always-on, broker-verified performance — coming soon."
      />

      {plan.plan_status === "comp" ? (
        // State A: comped founding leader
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard label="Your plan" value="Pro (Founding)" />
          </div>
          <Section title="Founding Pro access">
            <p className="text-sm text-muted">
              You&apos;ve been granted BigMarkt Pro as a founding leader — every Pro
              feature is yours at no cost, for keeps. Thanks for helping build this.
            </p>
          </Section>
        </div>
      ) : plan.plan === "pro" && plan.plan_status === "active" ? (
        // State B: active paying Pro
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard label="Your plan" value="Pro" />
          </div>
          <Section title="You're on Pro">
            <p className="text-sm text-muted">
              You have full access to every Pro feature. Thanks for being a member.
            </p>
          </Section>
        </div>
      ) : (
        // State C: free — the "Pro is coming" pitch + waitlist
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <MetricCard label="Your plan" value="Free" />
          </div>

          <Section title="What Pro will include">
            <ul className="divide-y divide-white/5">
              {PRO_FEATURES.map((feature) => (
                <li
                  key={feature}
                  className="flex items-center gap-3 py-2 text-sm text-white"
                >
                  <span aria-hidden className="text-gold">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Waitlist">
            {proInterestAt ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-win">
                  You&apos;re on the waitlist ✓
                </p>
                <p className="text-xs text-muted">
                  Joined {fmtDate(proInterestAt)}. We&apos;ll email you when Pro launches.
                </p>
                <LeaveWaitlistForm />
              </div>
            ) : (
              <UpgradeWaitlistForm />
            )}
          </Section>
        </div>
      )}
    </div>
  );
}
