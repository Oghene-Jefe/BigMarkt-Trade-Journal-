import { notFound } from "next/navigation";
import TradeForm from "@/components/TradeForm";
import { supabaseServer } from "@/lib/supabase/server";
import { signChart } from "@/lib/storage";
import type { TradeRow } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { updateTradeAction, type TradeActionState } from "../../../actions";

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data } = await sb.from("trades").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const trade = data as TradeRow;
  const existingChartUrl = trade.chart_path ? await signChart(trade.chart_path) : null;

  // Bind the row id into the update action so the form can reuse the
  // generic (state, fd) signature.
  async function bound(state: TradeActionState, fd: FormData) {
    "use server";
    return updateTradeAction(id, state, fd);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Edit trade" />
      <TradeForm trade={trade} existingChartUrl={existingChartUrl} action={bound} submitLabel="Save changes" />
    </div>
  );
}
