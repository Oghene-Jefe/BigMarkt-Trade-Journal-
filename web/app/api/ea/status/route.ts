import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("trades")
    .select("id, created_at")
    .eq("user_id", user.id)
    .eq("capture_source", "ea")
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Failed to query trades" }, { status: 500 });
  }

  const trade_count = data?.length ?? 0;
  const connected = trade_count > 0;
  const last_trade_at = data?.[0]?.created_at ?? null;

  return NextResponse.json({ connected, trade_count, last_trade_at });
}
