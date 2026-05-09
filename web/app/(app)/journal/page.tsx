import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signCharts } from "@/lib/storage";
import JournalTable from "@/components/JournalTable";
import type { TradeRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function JournalPage() {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("trades")
    .select("*")
    .order("created_at", { ascending: false });

  const trades = (data ?? []) as TradeRow[];
  const paths = trades.map((t) => t.chart_path).filter((p): p is string => !!p);
  const chartUrls = await signCharts(paths);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">JOURNAL</h1>
        <Link href="/journal/new" className="rounded-md bg-gold px-5 py-2 font-display tracking-widest text-black">
          NEW TRADE
        </Link>
      </div>
      {error ? <p className="text-sm text-loss">Couldn't load trades: {error.message}</p> : null}
      <JournalTable trades={trades} chartUrls={chartUrls} />
    </div>
  );
}
