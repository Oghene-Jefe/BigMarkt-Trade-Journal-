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

  return (
    <div className="min-h-screen bg-gray-900 -mx-4 -my-6 px-4 py-6">
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

      <ScoreCard accountId={acc.id} score={score} />
    </div>
  );
}
