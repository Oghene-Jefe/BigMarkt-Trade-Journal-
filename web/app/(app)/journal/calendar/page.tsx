import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { getActiveAccount } from "@/lib/accounts";
import CalendarClient from "./CalendarClient";
import { PageHeader } from "@/components/ui";
import type { TradeRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function JournalCalendarPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { activeId } = await getActiveAccount(sb, user!.id);

  let query = sb.from("trades").select("*");
  if (activeId) {
    query = query.eq("broker_account_id", activeId);
  }
  const { data: trades } = await query.order("created_at", { ascending: false });

  return (
    <div className="space-y-4">
      <Link
        href="/journal"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
      >
        <ArrowLeft size={12} aria-hidden />
        <span>Back to journal</span>
      </Link>
      <PageHeader
        title="Calendar"
        description="Click a day to view its trades in the journal."
      />
      <div className="rounded-lg border border-white/10 bg-panel p-4">
        <CalendarClient trades={(trades ?? []) as TradeRow[]} />
      </div>
    </div>
  );
}
