import { requireUser } from "@/lib/auth/require-user";
import { supabaseServer } from "@/lib/supabase/server";
import { BROKERS } from "@/lib/brokers";
import type { BrokerAccount } from "@/lib/types";
import ConfirmButton from "@/components/ConfirmButton";
import AddAccountModal from "./AddAccountModal";
import EditAccountModal from "./EditAccountModal";
import { toggleAccountActiveAction, deleteBrokerAccountAction } from "./actions";

export const dynamic = "force-dynamic";

const ACCOUNT_TYPE_META: Record<
  "live" | "demo" | "prop_firm",
  { label: string; emoji: string; classes: string }
> = {
  live: { label: "Live", emoji: "🟢", classes: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  demo: { label: "Demo", emoji: "🔵", classes: "bg-sky-500/10 text-sky-400 border-sky-500/30" },
  prop_firm: { label: "Prop Firm", emoji: "🟠", classes: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
};

export default async function AccountsPage() {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data } = await sb
    .from("broker_accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const accounts: BrokerAccount[] = (data ?? []) as BrokerAccount[];
  const hasPropFirm = accounts.some((a) => a.is_prop_firm);

  return (
    <div className="min-h-screen bg-gray-900 -mx-4 -my-6 px-4 py-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">My Accounts</h1>
          <p className="mt-1 text-sm text-white/60">
            Manage your connected broker accounts. Each account has its own journal mode.
          </p>
        </div>
        <AddAccountModal />
      </div>

      {hasPropFirm && (
        <div className="mb-6 rounded-md border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          Prop firm accounts are locked to Manual (Journal Only) mode. Copy execution is permanently disabled on these accounts.
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

            return (
              <div
                key={account.id}
                className={`rounded-lg border bg-black/30 p-4 ${
                  account.is_active ? "border-white/10" : "border-white/5 opacity-60"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-white">
                      <span className="font-semibold">{account.label}</span>
                      <span className="text-sm text-white/40">·</span>
                      <span className="text-sm text-white/70">{brokerName}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-xs ${typeMeta.classes}`}>
                        {typeMeta.emoji} {typeMeta.label}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/80">
                        {account.journal_mode === "automated" ? "🤖 Automated" : "✍️ Manual"}
                      </span>
                      {!account.is_active && (
                        <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-xs text-white/60">
                          Inactive
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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
