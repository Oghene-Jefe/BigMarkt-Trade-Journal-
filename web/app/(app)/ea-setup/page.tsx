import type { ReactNode } from "react";
import { Download, ChevronRight } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { getEaConnectionLogAction } from "@/lib/actions/ea-tokens";
import { PageHeader } from "@/components/ui";
import EaTokenManager from "./EaTokenManager";

export const dynamic = "force-dynamic";

export type EaTokenRow = {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  broker_account_id: string | null;
};

export type BrokerAccountOption = {
  id: string;
  label: string;
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

// Fetches the WS server's connection map. The endpoint is now a trusted
// server→server channel: we send the shared WS_STATUS_SECRET as a Bearer
// header, and the WS server rejects callers without it. If we don't have
// the secret in env, treat the endpoint as unavailable (returns null) —
// the UI degrades gracefully to "server offline" rather than leaking a
// half-broken state. The default port is the WS server's local default
// (8080), not 8081 which was a copy-paste from an older config.
async function getWsStatus(): Promise<WsStatus | null> {
  const url = process.env.WS_STATUS_URL ?? "http://localhost:8080/status";
  const secret = process.env.WS_STATUS_SECRET;
  if (!secret) return null;
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

// Restrict the WS-server's full connection list to the calling user's own
// active EA tokens. Without this filter, every authenticated user could
// see every other user's connected token IDs.
function filterStatusToUserTokens(
  status: WsStatus | null,
  userTokenIds: Set<string>,
): WsStatus | null {
  if (!status) return null;
  const mine = status.connections.filter((c) => userTokenIds.has(c.token_id));
  return {
    ...status,
    connected_clients: mine.length,
    connections: mine,
  };
}

export default async function EaSetupPage() {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data: tokens } = await sb
    .from("ea_tokens")
    .select("id, label, created_at, last_used_at, broker_account_id")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const activeTokens: EaTokenRow[] = (tokens ?? []) as EaTokenRow[];

  const { data: accountsData } = await sb
    .from("broker_accounts")
    .select("id, label")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const brokerAccounts: BrokerAccountOption[] = (accountsData ?? []) as BrokerAccountOption[];

  const rawStatus = await getWsStatus();
  const myTokenIds = new Set(activeTokens.map((t) => t.id));
  const wsStatus = filterStatusToUserTokens(rawStatus, myTokenIds);
  const connectionLog = await getEaConnectionLogAction();

  return (
    <div className="space-y-6">
      <PageHeader
        title="EA setup"
        description="Install the BigMarkt read-only EA on MT4/MT5 and stream every fill into your journal. Five steps, about three minutes."
      />

      <Step n={1} title="Generate a token">
        <p className="mb-4 text-sm text-muted">
          A token authenticates your EA. Each MT4/MT5 terminal should use its own. Maximum of 5 active tokens per account.
        </p>
        <EaTokenManager
          tokens={activeTokens}
          wsStatus={wsStatus}
          connectionLog={connectionLog}
          brokerAccounts={brokerAccounts}
        />
      </Step>

      <Step n={2} title="Download the EA">
        <p className="mb-4 text-sm text-muted">
          One MQL5 file. Works on both MT4 and MT5 builds 1300+.
        </p>
        <a
          href="/downloads/BigMarkt_EA.mq5"
          download
          className="inline-flex items-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:bg-gold/90"
        >
          <Download size={14} aria-hidden />
          <span>Download BigMarkt_EA.mq5</span>
        </a>
        <p className="mt-3 text-xs text-muted">
          Read-only by design — the EA never calls{" "}
          <Mono>OrderSend</Mono>, <Mono>OrderModify</Mono>, or <Mono>OrderClose</Mono>.
        </p>
      </Step>

      <Step n={3} title="Install in MetaTrader and paste your token">
        <ol className="space-y-2 text-sm text-white/80">
          <li>
            Open <em>File → Open Data Folder</em>, then drop{" "}
            <Mono>BigMarkt_EA.mq5</Mono> into <Mono>MQL5/Experts</Mono> (or{" "}
            <Mono>MQL4/Experts</Mono> on MT4).
          </li>
          <li>
            Right-click <em>Expert Advisors</em> in the Navigator panel and pick{" "}
            <em>Refresh</em>. Double-click the file in MetaEditor to compile.
          </li>
          <li>
            Drag <Mono>BigMarkt_EA</Mono> onto any chart and paste the token from
            Step 1 into the <Mono>ApiToken</Mono> input.
          </li>
          <li>
            In <em>Tools → Options → Expert Advisors</em>, tick{" "}
            <em>Allow WebRequest for listed URL</em> and add{" "}
            <Mono>https://journal.bigmarkt.co</Mono>.
          </li>
          <li>
            Click <em>AutoTrading</em> in the top toolbar so it turns green.
          </li>
        </ol>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted hover:text-white">
            Advanced setup (magic number filtering, MT4 differences)
          </summary>
          <AdvancedSetup />
        </details>
      </Step>

      <Step n={4} title="Send a test trade">
        <p className="text-sm text-white/80">
          Place a tiny test trade (0.01 lot) or wait for your next fill.
        </p>
      </Step>

      <Step n={5} title="Confirm the connection">
        <p className="text-sm text-white/80">Within a few seconds you should see:</p>
        <ul className="mt-2 ml-5 list-disc space-y-1 text-sm text-white/80">
          <li>
            A new row in your{" "}
            <a href="/journal" className="text-gold underline hover:text-white">
              journal
            </a>{" "}
            tagged{" "}
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
              auto_verified
            </span>
            .
          </li>
          <li>The token's <em>Last used</em> timestamp updating above.</li>
        </ul>
        <details className="mt-4">
          <summary className="cursor-pointer text-xs text-muted hover:text-white">
            Troubleshooting
          </summary>
          <Troubleshooting />
        </details>
      </Step>

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
            Step 1, then install the EA on each terminal. All trades will
            appear in your unified BigMarkt journal.
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

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-panel p-5">
      <header className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-xs font-medium text-gold">
          {n}
        </span>
        <h2 className="text-base font-medium text-white">{title}</h2>
      </header>
      <div className="mt-4 sm:ml-10">{children}</div>
    </section>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-black/40 px-1 font-mono text-xs">{children}</code>
  );
}

function AdvancedSetup() {
  return (
    <div className="mt-3 space-y-3 rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/80">
      <div>
        <p className="font-medium text-white">Filter by magic number</p>
        <p className="mt-1 text-white/70">
          The <Mono>FilterMagic</Mono> EA input controls which trades get journaled:
        </p>
        <ul className="mt-2 ml-4 list-disc space-y-1 text-white/70">
          <li>
            <Mono>-1</Mono> (default) — capture <em>all</em> trades, including bot trades.
          </li>
          <li>
            <Mono>0</Mono> — capture <em>manual trades only</em> (no magic number).
          </li>
          <li>Any positive number — capture only trades from that bot's magic.</li>
        </ul>
      </div>
      <div>
        <p className="font-medium text-white">MT4 differences</p>
        <p className="mt-1 text-white/70">
          On MT4, files live in <Mono>MQL4/Experts</Mono>. The same .mq5 file
          compiles on both MT4 and MT5 builds 1300+.
        </p>
      </div>
      <div>
        <p className="font-medium text-white">Prop firm accounts</p>
        <p className="mt-1 text-white/70">
          The EA is read-only and journal-only. It never sends orders, so it
          complies with FTMO / FundedNext / MyForexFunds rules.
        </p>
      </div>
    </div>
  );
}

function Troubleshooting() {
  return (
    <ul className="mt-3 ml-4 list-disc space-y-2 rounded-md border border-white/10 bg-black/30 p-3 text-xs text-white/80">
      <li>
        <span className="text-white">No trades appearing?</span> Toggle{" "}
        <Mono>DebugMode = true</Mono> in the EA inputs and check the{" "}
        <em>Experts</em> tab in MT5 for error logs.
      </li>
      <li>
        <span className="text-white">HTTP 401 in logs?</span> The token is wrong
        or revoked — generate a fresh one in Step 1.
      </li>
      <li>
        <span className="text-white">HTTP 4060?</span> WebRequest URL not
        allowed. Re-check Step 3, item 4, and that the URL is exactly{" "}
        <Mono>https://journal.bigmarkt.co</Mono>.
      </li>
      <li>
        <span className="text-white">AutoTrading off?</span> Click the
        top-toolbar button so it turns green.
      </li>
    </ul>
  );
}
