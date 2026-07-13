import Link from "next/link";
import { Bot, PenLine, Cloud } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseServer } from "@/lib/supabase/server";
import { BROKERS } from "@/lib/brokers";
import type { BrokerAccount } from "@/lib/types";
import ConfirmButton from "@/components/ConfirmButton";
import { StatusPill } from "@/components/ui";
import AddAccountModal from "./AddAccountModal";
import CloudConnectModal from "./CloudConnectModal";
import CloudSyncButton from "./CloudSyncButton";
import EditAccountModal from "./EditAccountModal";
import { isAdmin } from "@/lib/admin";
import { isPro } from "@/lib/plan";
import { toggleAccountActiveAction, deleteBrokerAccountAction } from "./actions";

export const dynamic = "force-dynamic";

const ACCOUNT_TYPE_META: Record<
  "live" | "demo" | "prop_firm",
  { label: string; tone: "ok" | "info" | "warn" }
> = {
  live: { label: "Live", tone: "ok" },
  demo: { label: "Demo", tone: "info" },
  prop_firm: { label: "Prop firm", tone: "warn" },
};

const CLOUD_STATUS_META: Record<
  string,
  { label: string; tone: "info" | "warn" | "error" | "neutral" }
> = {
  active: { label: "Cloud · Live", tone: "info" },
  provisioning: { label: "Cloud · Provisioning…", tone: "warn" },
  error: { label: "Cloud · Error", tone: "error" },
  paused: { label: "Cloud · Paused", tone: "neutral" },
  revoked: { label: "Cloud · Revoked", tone: "neutral" },
};

export default async function AccountsPage() {
  const user = await requireUser();
  const admin = await isAdmin();
  const canCloud = admin || (await isPro());
  const sb = await supabaseServer();
  const { data } = await sb
    .from("broker_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const accounts: BrokerAccount[] = (data ?? []) as BrokerAccount[];
  const hasPropFirm = accounts.some((a) => a.is_prop_firm);

  // Cloud (MetaApi) connection status per broker account, for the status pill.
  const { data: connData } = await sb
    .from("metaapi_connections")
    .select("id, broker_account_id, status")
    .eq("user_id", user.id);
  const cloudByAccount = new Map<string, { id: string; status: string }>();
  for (const c of (connData ?? []) as { id: string; broker_account_id: string; status: string }[]) {
    cloudByAccount.set(c.broker_account_id, { id: c.id, status: c.status });
  }

  return (
    <div className="min-h-screen bg-bg -mx-4 -my-6 px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Accounts</h1>
          <p className="mt-1 text-sm text-white/60">
            Manage your connected broker accounts. Each account has its own journal mode.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canCloud && <CloudConnectModal />}
          <AddAccountModal />
        </div>
      </div>

      {hasPropFirm && (
        <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Prop firm accounts are locked to Manual (Journal Only) mode. The EA only reads and logs your trades — it never executes on your account.
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-8 text-center text-white/60">
          No accounts yet. Add your first broker account to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => {
            const broker = BROKERS.find((b) => b.id === account.broker_slug);
            const brokerName = broker?.name ?? account.broker_slug;
            const typeMeta = ACCOUNT_TYPE_META[account.account_type];
            const cloud = cloudByAccount.get(account.id);
            const cloudMeta = cloud
              ? CLOUD_STATUS_META[cloud.status] ?? { label: "Cloud", tone: "neutral" as const }
              : null;

            return (
              <div
                key={account.id}
                className={`rounded-lg border bg-black/30 p-4 ${
                  account.is_active ? "border-white/10" : "border-white/5 opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/accounts/${account.id}`}
                      className="flex items-center gap-2 text-white no-underline hover:opacity-80"
                    >
                      <span className="font-semibold">{account.label}</span>
                      <span className="text-sm text-white/40">·</span>
                      <span className="text-sm text-white/70">{brokerName}</span>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusPill tone={typeMeta.tone}>{typeMeta.label}</StatusPill>
                      {account.journal_mode === "automated" ? (
                        <StatusPill tone="ok" icon={<Bot size={12} aria-hidden />}>
                          Automated
                        </StatusPill>
                      ) : (
                        <StatusPill tone="neutral" icon={<PenLine size={12} aria-hidden />}>
                          Manual
                        </StatusPill>
                      )}
                      {cloudMeta && (
                        <StatusPill tone={cloudMeta.tone} icon={<Cloud size={12} aria-hidden />}>
                          {cloudMeta.label}
                        </StatusPill>
                      )}
                      {!account.is_active && (
                        <StatusPill tone="neutral">Inactive</StatusPill>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {cloud && <CloudSyncButton connectionId={cloud.id} />}
                    <form action={toggleAccountActiveAction as unknown as (fd: FormData) => void}>
                      <input type="hidden" name="id" value={account.id} />
                      <input type="hidden" name="is_active" value={(!account.is_active).toString()} />
                      <button
                        type="submit"
                        className="rounded-md border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
                      >
                        {account.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                    <EditAccountModal account={account} />
                    <form action={deleteBrokerAccountAction as unknown as (fd: FormData) => void}>
                      <input type="hidden" name="id" value={account.id} />
                      <ConfirmButton
                        message={`Delete "${account.label}"? Trades linked to this account will be unlinked but not deleted.`}
                        className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
