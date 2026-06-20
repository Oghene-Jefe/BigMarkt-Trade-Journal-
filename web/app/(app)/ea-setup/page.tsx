import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { getEaConnectionLogAction } from "@/lib/actions/ea-tokens";
import { getActiveAccount } from "@/lib/accounts";
import { PageHeader } from "@/components/ui";
import EaTokenManager from "./EaTokenManager";
import EaSetupWizard from "@/components/ea-setup/EaSetupWizard";

export const dynamic = "force-dynamic";

export type EaTokenRow = {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  broker_account_id: string | null;
  /** True for tokens predating migration 0041 (no encrypted signing secret).
   *  Surfaced in the UI as a "legacy / regenerate to enable v2" badge. */
  is_legacy: boolean;
};

export type BrokerAccountOption = {
  id: string;
  label: string;
  account_type: string;
};

export type WsStatus = {
  connected_clients: number;
  server_uptime_seconds: number;
  ts: number;
  connections: Array<{
    token_id: string;
    last_ping_ms_ago: number;
    stale?: boolean;
  }>;
};

// Fetches the WS server's connection state, scoped to the calling user's
// active EA token IDs. The WS server's /status endpoint is the trust
// boundary:
//
//   1. WS_STATUS_SECRET on the Authorization header gates access at all.
//   2. ?token_ids=… is the allow-list the WS server uses to filter its
//      in-memory authedSockets before returning. The server NEVER exposes
//      its global connection map — even to us.
//
// So the right shape is: pass the user's active token IDs into this
// fetcher, send them as a query param, and trust the response as-is. If
// either env var is unset, return null and the UI degrades gracefully to
// "server offline." The default port matches the WS server's local
// default (WS_PORT=8080).
async function getWsStatus(userTokenIds: string[]): Promise<WsStatus | null> {
  const baseUrl = process.env.WS_STATUS_URL ?? "http://localhost:8080/status";
  const secret = process.env.WS_STATUS_SECRET;
  if (!secret) return null;
  // No tokens to ask about → don't bother the WS server; it would just
  // return an empty list. Saves a round-trip on fresh accounts.
  if (userTokenIds.length === 0) {
    return {
      connected_clients: 0,
      server_uptime_seconds: 0,
      ts: Date.now(),
      connections: [],
    };
  }
  const url = `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}token_ids=${encodeURIComponent(userTokenIds.join(","))}`;
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(2000),
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as WsStatus;
  } catch {
    return null;
  }
}

export default async function EaSetupPage() {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data: tokens } = await sb
    .from("ea_tokens")
    .select(
      "id, label, created_at, last_used_at, broker_account_id, signing_secret_ciphertext",
    )
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const activeTokens: EaTokenRow[] = (tokens ?? []).map((t) => {
    const row = t as { signing_secret_ciphertext: string | null } & Omit<EaTokenRow, "is_legacy">;
    return {
      id: row.id,
      label: row.label,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      broker_account_id: row.broker_account_id,
      is_legacy: !row.signing_secret_ciphertext,
    };
  });

  const { data: accountsData } = await sb
    .from("broker_accounts")
    .select("id, label, account_type")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const brokerAccounts: BrokerAccountOption[] = (accountsData ?? []) as BrokerAccountOption[];

  // The active account (global switcher) seeds the Generate-token select so the
  // common case is one click. getActiveAccount also self-heals a missing
  // active id, but Generate stays disabled until the user actually has an account.
  const { activeId } = await getActiveAccount(sb, user.id);
  const defaultAccountId =
    brokerAccounts.find((a) => a.id === activeId)?.id ?? brokerAccounts[0]?.id ?? "";

  const wsStatus = await getWsStatus(activeTokens.map((t) => t.id));
  const connectionLog = await getEaConnectionLogAction();

  // The EaTokenManager is a server-rendered client component we pass into
  // the wizard as a pre-rendered ReactNode (RSC composition pattern). This
  // keeps all the token generation / revocation logic untouched while the
  // wizard shell handles step navigation.
  const tokenManagerNode = (
    <EaTokenManager
      tokens={activeTokens}
      wsStatus={wsStatus}
      connectionLog={connectionLog}
      brokerAccounts={brokerAccounts}
      defaultAccountId={defaultAccountId}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="EA setup"
        description="Install the BigMarkt read-only EA on MT5 and stream every fill into your journal. Four steps, about five minutes."
      />

      <EaSetupWizard
        tokens={activeTokens}
        wsStatus={wsStatus}
        brokerAccounts={brokerAccounts}
        EaTokenManagerComponent={tokenManagerNode}
      />

      {/* FAQ — always visible below the wizard */}
      <section className="rounded-lg border border-white/10 bg-panel p-5">
        <h2 className="text-base font-medium text-white">FAQ</h2>
        <div className="mt-3 space-y-2">
          <Faq q="Which brokers are supported?">
            BigMarkt EA works with any MT4/MT5 broker. Check our{" "}
            <a href="/brokers" className="text-gold underline hover:text-white">
              recommended brokers
            </a>{" "}
            list for verified options.
          </Faq>
          <Faq q="Why are my trades not appearing?">
            Ensure the EA is enabled and AutoTrading is turned on in MetaTrader.
            Check that your token is entered correctly in the EA settings, and
            that the WebRequest URL allow-list includes{" "}
            <Mono>https://journal.bigmarkt.co</Mono>.
          </Faq>
          <Faq q="Can I use the EA on multiple accounts?">
            Yes. Generate a separate token for each MetaTrader instance from
            Step 3 (credentials), then install the EA on each terminal. All trades
            will appear in your unified BigMarkt journal.
          </Faq>
        </div>
      </section>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-md border border-white/10 bg-black/20 p-3 open:bg-black/30">
      <summary className="flex cursor-pointer items-center justify-between text-sm font-medium text-white">
        <span>{q}</span>
        <ChevronRight
          size={16}
          aria-hidden
          className="text-gold transition-transform group-open:rotate-90"
        />
      </summary>
      <p className="mt-2 text-sm text-white/70">{children}</p>
    </details>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-black/40 px-1 font-mono text-xs">{children}</code>
  );
}
