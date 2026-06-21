// Branded, same-origin proxy for private trade-chart images.
//
// Renders journal.bigmarkt.co/c/<tradeId> instead of leaking a raw Supabase
// signed URL (which exposes the project ref and looks unbranded). Access is
// gated by the get_chart_path_for_viewer RPC (migration 0061): the owner sees
// their own chart, and anyone may see a chart that belongs to a public trade on
// a community/public profile — the same visibility rule as get_public_trades.
// The Supabase signed URL is fetched server-side and only the bytes are
// streamed back, so the storage URL never reaches the client.
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { signChart } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const sb = await supabaseServer();

  const { data: chartPath, error } = await sb.rpc("get_chart_path_for_viewer", {
    p_trade_id: id,
  });

  if (error || !chartPath || typeof chartPath !== "string") {
    return new NextResponse("Not found", { status: 404 });
  }

  const signedUrl = await signChart(chartPath);
  if (!signedUrl) {
    return new NextResponse("Not found", { status: 404 });
  }

  const upstream = await fetch(signedUrl);
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=600",
    },
  });
}
