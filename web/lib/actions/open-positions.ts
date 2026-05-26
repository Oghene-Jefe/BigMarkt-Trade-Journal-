"use server";

import { supabaseServer } from "@/lib/supabase/server";

export type OpenPosition = {
  id: string;
  pair: string | null;
  direction: "BUY" | "SELL" | null;
  lot_size: number | null;
  entry_price: number | null;
  open_time: string | null;
  sl: number | null;
  tp: number | null;
  created_at: string;
};

export async function getOpenPositionsAction(
  userId: string,
  accountId: string | null,
): Promise<OpenPosition[]> {
  const sb = await supabaseServer();
  let q = sb
    .from("trades")
    .select("id, pair, direction, lot_size, entry_price, open_time, sl, tp, created_at")
    .eq("user_id", userId)
    .eq("status", "open")
    .order("created_at", { ascending: false });

  if (accountId) {
    q = q.eq("broker_account_id", accountId);
  }

  const { data } = await q;
  return (data ?? []) as OpenPosition[];
}
