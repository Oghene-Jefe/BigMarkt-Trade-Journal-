"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";

const PAGE_SIZE = 20;

const TRADE_FIELDS =
  "id, pair, direction, lot_size, entry_price, exit_price, pnl, result, open_time, close_time, trust_badge, capture_source, notes, created_at";

export type Trade = {
  id: string;
  pair: string;
  direction: string;
  lot_size: number | null;
  entry_price: number | null;
  exit_price: number | null;
  pnl: number | null;
  result: string | null;
  open_time: string | null;
  close_time: string | null;
  trust_badge: string | null;
  capture_source: string | null;
  notes: string | null;
  created_at: string;
};

export type TradeFilter = "all" | "auto_verified" | "manual" | "draft";

export type GetTradesResult =
  | { trades: Trade[]; total: number; page: number; pageSize: number }
  | { error: string };

export async function getTradesAction(
  params: { page?: number; filter?: TradeFilter } = {}
): Promise<GetTradesResult> {
  const page = params.page ?? 1;
  const filter = params.filter ?? "all";

  const user = await requireUser();
  const sb = await supabaseServer();

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = sb
    .from("trades")
    .select(TRADE_FIELDS)
    .eq("user_id", user.id);

  if (filter !== "all") {
    query = query.eq("trust_badge", filter);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) return { error: error.message };

  let countQuery = sb
    .from("trades")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (filter !== "all") {
    countQuery = countQuery.eq("trust_badge", filter);
  }

  const { count, error: countError } = await countQuery;

  if (countError) return { error: countError.message };

  return {
    trades: (data ?? []) as unknown as Trade[],
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  };
}
