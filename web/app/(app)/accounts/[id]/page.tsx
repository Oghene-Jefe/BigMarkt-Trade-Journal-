import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseServer } from "@/lib/supabase/server";
import type { AccountScore, BrokerAccount } from "@/lib/types";
import ScoreCard from "./ScoreCard";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data: account } = await sb
    .from("broker_accounts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!account) notFound();

  const acc = account as BrokerAccount;

  const { data: scoreRow } = await sb
    .from("account_scores")
    .select("*")
    .eq("broker_account_id", id)
    .maybeSingle();

  const score = (scoreRow as AccountScore | null) ?? null;

  const { data: connRow } = await sb
    .from("metaapi_connections")
    .select("status, balance, equity, deposits, profit, gain, metrics_updated_at")
    .eq("broker_account_id", id)
    .maybeSingle();
  const conn = connRow as {
    status: string;
    balance: number | null;
    equity: number | null;
    deposits: number | null;
    profit: number | null;
    gain: number | null;
    metrics_updated_at: string | null;
  } | null;

  return (
    <div className="min-h-screen bg-bg -mx-4 -my-6 px-4 py-6">
      <div className="mb-6">
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white"
        >
          <ArrowLeft size={14} aria-hidden />
          <span>Back to accounts</span>
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">{acc.label}</h1>
        <p className="mt-1 text-sm text-white/60">
          {acc.broker_slug} · {acc.account_type} · {acc.journal_mode}
        </p>
      </div>

      {conn && (
        <div className="mb-6 rounded-lg border border-white/10 bg-panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gold">Cloud account</h3>
            {conn.metrics_updated_at ? (
              <span className="text-[11px] text-muted">
                Updated {new Date(conn.metrics_updated_at).toLocaleString()}
              </span>
            ) : null}
          </div>
          {conn.balance == null ? (
            <p className="text-sm text-muted">
              Click &ldquo;Sync now&rdquo; on the accounts page to load this account&rsquo;s balance and growth.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Balance" value={fmtNum(conn.balance)} />
              <Metric
                label="Growth"
                value={conn.gain != null ? `${conn.gain >= 0 ? "+" : ""}${conn.gain.toFixed(2)}%` : "—"}
                tone={conn.gain == null ? "neutral" : conn.gain >= 0 ? "win" : "loss"}
              />
              <Metric label="Deposits" value={fmtNum(conn.deposits)} />
              <Metric
                label="Profit"
                value={fmtNum(conn.profit)}
                tone={conn.profit == null ? "neutral" : conn.profit >= 0 ? "win" : "loss"}
              />
            </div>
          )}
        </div>
      )}

      <ScoreCard accountId={acc.id} score={score} />
    </div>
  );
}

function fmtNum(n: number | null): string {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "win" | "loss";
}) {
  const color = tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : "text-white";
  return (
    <div className="rounded-md bg-bg p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
