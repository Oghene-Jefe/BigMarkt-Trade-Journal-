import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import EaTokenManager from "./EaTokenManager";

export const dynamic = "force-dynamic";

export type EaTokenRow = {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
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

async function getWsStatus(): Promise<WsStatus | null> {
  const url = process.env.WS_STATUS_URL ?? "http://localhost:8081/status";
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(2000) });
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
    .select("id, label, created_at, last_used_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  const activeTokens: EaTokenRow[] = tokens ?? [];
  const wsStatus = await getWsStatus();

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-widest text-gold">
          EA SETUP
        </h1>
        <p className="mt-1 text-sm text-muted">
          Install the BigMarkt read-only EA on MT4/MT5 and stream every fill
          straight into your journal. Four steps, about three minutes.
        </p>
      </header>

      {/* Step 1 — Token manager */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-panel p-5">
        <div>
          <h2 className="font-display text-lg tracking-widest text-gold">
            STEP 1 — GENERATE YOUR TOKEN
          </h2>
          <p className="mt-1 text-xs text-muted">
            A token authenticates your EA. Each MT4/MT5 terminal should use its
            own. Maximum of 5 active tokens per account.
          </p>
        </div>
        <EaTokenManager tokens={activeTokens} wsStatus={wsStatus} />
      </section>

      {/* Step 2 — Download */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-panel p-5">
        <div>
          <h2 className="font-display text-lg tracking-widest text-gold">
            STEP 2 — DOWNLOAD THE EA
          </h2>
          <p className="mt-1 text-xs text-muted">
            One MQL5 file. Works on both MT4 and MT5 builds 1300+.
          </p>
        </div>
        <a
          href="/downloads/BigMarkt_EA.mq5"
          download
          className="inline-flex items-center gap-2 rounded-md bg-gold/90 px-4 py-2 text-sm font-medium text-black hover:bg-gold transition-colors"
        >
          ⬇ Download BigMarkt_EA.mq5
        </a>
        <p className="text-[11px] text-muted">
          Read-only by design — the EA never calls{" "}
          <code className="rounded bg-black/40 px-1 font-mono">OrderSend</code>,{" "}
          <code className="rounded bg-black/40 px-1 font-mono">OrderModify</code>{" "}
          or{" "}
          <code className="rounded bg-black/40 px-1 font-mono">OrderClose</code>.
        </p>
      </section>

      {/* Step 3 — Install */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-panel p-5">
        <h2 className="font-display text-lg tracking-widest text-gold">
          STEP 3 — INSTALL ON MT5
        </h2>
        <ol className="space-y-3 text-sm text-white/80">
          <li>
            <span className="font-semibold text-white">1. Copy the file.</span>{" "}
            In MetaTrader, open <em>File → Open Data Folder</em>, then drop{" "}
            <code className="rounded bg-black/40 px-1 font-mono">
              BigMarkt_EA.mq5
            </code>{" "}
            into{" "}
            <code className="rounded bg-black/40 px-1 font-mono">
              MQL5/Experts
            </code>{" "}
            (or{" "}
            <code className="rounded bg-black/40 px-1 font-mono">
              MQL4/Experts
            </code>{" "}
            on MT4).
          </li>
          <li>
            <span className="font-semibold text-white">2. Refresh Navigator.</span>{" "}
            Right-click <em>Expert Advisors</em> in the Navigator panel and pick{" "}
            <em>Refresh</em>. Compile the file by double-clicking it in MetaEditor.
          </li>
          <li>
            <span className="font-semibold text-white">3. Attach to a chart.</span>{" "}
            Drag{" "}
            <code className="rounded bg-black/40 px-1 font-mono">BigMarkt_EA</code>{" "}
            onto any chart — the symbol does not matter, deals are captured
            account-wide.
          </li>
          <li>
            <span className="font-semibold text-white">4. Paste your token.</span>{" "}
            In the EA inputs dialog, paste the token from Step 1 into{" "}
            <code className="rounded bg-black/40 px-1 font-mono">ApiToken</code>.
          </li>
          <li>
            <span className="font-semibold text-white">
              4b. (Optional) Filter by magic number.
            </span>{" "}
            The{" "}
            <code className="rounded bg-black/40 px-1 font-mono">FilterMagic</code>{" "}
            input controls which trades get journaled:
            <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-white/70">
              <li>
                <code className="rounded bg-black/40 px-1 font-mono">-1</code>{" "}
                (default) — capture <em>all</em> trades, including bot trades.
              </li>
              <li>
                <code className="rounded bg-black/40 px-1 font-mono">0</code> —
                capture <em>manual trades only</em> (deals with no magic number).
              </li>
              <li>
                Any positive number — capture only trades from the trading bot
                with that magic number.
              </li>
            </ul>
          </li>
          <li>
            <span className="font-semibold text-white">
              5. Allow WebRequest.
            </span>{" "}
            Open <em>Tools → Options → Expert Advisors</em>, tick{" "}
            <em>Allow WebRequest for listed URL</em>, and add:
            <pre className="mt-2 rounded bg-black/50 p-2 text-xs font-mono text-emerald-300">
              https://journal.bigmarkt.co
            </pre>
          </li>
          <li>
            <span className="font-semibold text-white">6. Enable AutoTrading.</span>{" "}
            Click the <em>AutoTrading</em> button in the top toolbar so it turns
            green. The smiley face on the chart should now be 🙂.
          </li>
        </ol>
      </section>

      {/* Step 4 — Verify */}
      <section className="space-y-3 rounded-2xl border border-white/10 bg-panel p-5">
        <h2 className="font-display text-lg tracking-widest text-gold">
          STEP 4 — VERIFY IT'S WORKING
        </h2>
        <p className="text-sm text-white/80">
          Place a tiny test trade (0.01 lot) or wait for your next fill. Within a
          few seconds you should see:
        </p>
        <ul className="ml-4 list-disc space-y-1 text-sm text-white/80">
          <li>
            A new row in your{" "}
            <a href="/journal" className="text-gold underline hover:text-white">
              journal
            </a>{" "}
            tagged with the{" "}
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
              auto_verified
            </span>{" "}
            badge.
          </li>
          <li>
            The token's <em>Last used</em> timestamp updating on this page.
          </li>
        </ul>

        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <h3 className="text-sm font-semibold text-white">Troubleshooting</h3>
          <ul className="mt-2 ml-4 list-disc space-y-1 text-xs text-white/70">
            <li>
              <span className="text-white">No trades appearing?</span> Toggle{" "}
              <code className="rounded bg-black/40 px-1 font-mono">
                DebugMode = true
              </code>{" "}
              in the EA inputs and check the <em>Experts</em> tab in MT5 for
              error logs.
            </li>
            <li>
              <span className="text-white">HTTP 401 in logs?</span> The token is
              wrong or revoked — generate a fresh one above.
            </li>
            <li>
              <span className="text-white">HTTP 4060?</span> WebRequest URL not
              allowed. Re-check Step 3.5 and that the URL is exactly{" "}
              <code className="rounded bg-black/40 px-1 font-mono">
                https://journal.bigmarkt.co
              </code>
              .
            </li>
            <li>
              <span className="text-white">Smiley face on chart is 😞?</span>{" "}
              AutoTrading is off — click the top-toolbar button so it turns
              green.
            </li>
            <li>
              <span className="text-white">Prop firm account?</span> The EA is
              read-only and journal-only by default. It never sends orders, so
              it complies with FTMO / FundedNext / MyForexFunds rules.
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
