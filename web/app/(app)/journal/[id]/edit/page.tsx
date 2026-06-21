import { notFound } from "next/navigation";
import TradeForm from "@/components/TradeForm";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveAccount } from "@/lib/accounts";
import { chartProxyUrl } from "@/lib/chart-url";
import type { TradeRow } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { updateTradeAction, type TradeActionState } from "../../../actions";

export default async function EditTradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data } = await sb.from("trades").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const trade = data as TradeRow;
  const existingChartUrl = trade.chart_path ? chartProxyUrl(id, trade.chart_path) : null;
  const { activeId, accounts } = await getActiveAccount(sb, user.id);

  // Bind the row id into the update action so the form can reuse the
  // generic (state, fd) signature.
  async function bound(state: TradeActionState, fd: FormData) {
    "use server";
    return updateTradeAction(id, state, fd);
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Edit trade" />
      <TradeForm
        trade={trade}
        existingChartUrl={existingChartUrl}
        action={bound}
        submitLabel="Save changes"
        accounts={accounts}
        defaultAccountId={activeId}
      />
    </div>
  );
}
