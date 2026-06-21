// Public (no-auth) aggregate stats for the marketing homepage StatBar
// (bigmarkt.co). Reuses the same anon Supabase client + get_platform_stats()
// RPC that web/app/page.tsx calls server-side, so access matches the
// anon-granted, SECURITY DEFINER function (migration 0025).
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Match the marketing fetch's 5-min ISR.
export const revalidate = 300;

type PlatformStatsRow = {
  total_traders: number | null;
  auto_verified_trades: number | null;
  public_leaders: number | null;
};

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export async function GET() {
  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("get_platform_stats");

  if (error) {
    return NextResponse.json({ error: "stats_unavailable" }, { status: 500 });
  }

  // The RPC may return a single row or a one-element array — normalize both.
  const row = (Array.isArray(data) ? data[0] : data) as PlatformStatsRow | null;

  return NextResponse.json({
    total_traders: num(row?.total_traders),
    auto_verified_trades: num(row?.auto_verified_trades),
    public_leaders: num(row?.public_leaders),
  });
}
