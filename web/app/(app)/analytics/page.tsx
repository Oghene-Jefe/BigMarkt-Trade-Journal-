import { Plus } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import type { TradeRow } from "@/lib/types";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import EquityCurveChart from "@/components/analytics/EquityCurveChart";
import DrawdownChart from "@/components/analytics/DrawdownChart";
import WinRateByPairChart from "@/components/analytics/WinRateByPairChart";
import SessionChart from "@/components/analytics/SessionChart";
import SetupGradeChart from "@/components/analytics/SetupGradeChart";
import PsychologyAdvisor from "@/components/analytics/PsychologyAdvisor";
import ReportCardSection from "@/components/reportCard/ReportCardSection";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data, error } = await sb.from("trades").select("*");

  if (error) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4">
        <PageHeader title="Analytics" />
        <div className="rounded-lg border border-loss/30 bg-loss/10 p-8 text-center">
          <p className="text-base font-medium text-loss">Failed to load</p>
          <p className="mt-2 text-sm text-muted">
            Please refresh the page.
          </p>
        </div>
      </div>
    );
  }

  const trades = ((data ?? []) as TradeRow[]).filter(
    (t) => t.visibility !== "exclude",
  );

  const { data: profile } = user
    ? await sb
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const emailLocal = (user?.email ?? "trader").split("@")[0]!;
  const username: string =
    (profile?.username && profile.username.trim()) ||
    (profile?.display_name && profile.display_name.trim()) ||
    emailLocal;

  if (trades.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4">
        <PageHeader title="Analytics" />
        <EmptyState
          title="No data yet"
          description="No trades to analyse yet. Start logging trades to unlock your analytics."
          action={
            <LinkButton href="/journal/new" icon={<Plus size={14} aria-hidden />}>
              New trade
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4">
      <PageHeader title="Analytics" />

      <section className="space-y-4">
        <SectionHeading title="Report cards" />
        <ReportCardSection trades={trades} username={username} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Performance" />
        <EquityCurveChart trades={trades} />
        <DrawdownChart trades={trades} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Breakdown" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <WinRateByPairChart trades={trades} />
          <SessionChart trades={trades} />
        </div>
        <SetupGradeChart trades={trades} />
      </section>

      <section className="space-y-4">
        <SectionHeading title="Psychology" />
        <PsychologyAdvisor trades={trades} />
      </section>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="border-b border-gold/40 pb-2">
      <h2 className="text-base font-semibold text-gold">{title}</h2>
    </div>
  );
}
