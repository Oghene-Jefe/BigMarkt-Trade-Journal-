import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";
import { syncBybitAction } from "./sync";

export const dynamic = "force-dynamic";

type ConnectionRow = {
  id: string;
  exchange: "bybit";
  environment: "mainnet" | "testnet";
  account_label: string | null;
  api_key_hint: string | null;
  status: "active" | "paused" | "error" | "revoked";
  ip_bound: boolean;
  bound_ips: string[];
  permissions: Record<string, string[]>;
  last_sync_at: string | null;
  last_error: string | null;
  is_master: boolean | null;
  is_uta: boolean | null;
  external_user_id: string | null;
  created_at: string;
};

type SyncRunRow = {
  id: string;
  connection_id: string;
  status: "running" | "success" | "partial" | "failed";
  started_at: string;
  finished_at: string | null;
  imported_count: number;
  skipped_count: number;
  error_message: string | null;
  category: string | null;
};

export default async function ExchangesPage() {
  const sb = await supabaseServer();

  const [{ data: connData, error }, { data: runData }] = await Promise.all([
    sb
      .from("exchange_connections")
      .select(
        "id, exchange, environment, account_label, api_key_hint, status, ip_bound, bound_ips, permissions, last_sync_at, last_error, is_master, is_uta, external_user_id, created_at",
      )
      .order("created_at", { ascending: false }),
    sb
      .from("exchange_sync_runs")
      .select(
        "id, connection_id, status, started_at, finished_at, imported_count, skipped_count, error_message, category",
      )
      .order("started_at", { ascending: false })
      .limit(20),
  ]);

  const connections = (connData ?? []) as ConnectionRow[];
  const runs = (runData ?? []) as SyncRunRow[];

  const runsByConnection = new Map<string, SyncRunRow[]>();
  for (const r of runs) {
    const arr = runsByConnection.get(r.connection_id) ?? [];
    arr.push(r);
    runsByConnection.set(r.connection_id, arr);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">EXCHANGES</h1>
        <Link
          href="/exchanges/new"
          className="rounded-md bg-gold px-5 py-2 font-display tracking-widest text-black"
        >
          + CONNECT
        </Link>
      </div>

      {error ? <p className="text-sm text-loss">{error.message}</p> : null}

      {connections.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-panel p-12 text-center">
          <p className="font-display text-2xl tracking-widest text-gold">NO CONNECTIONS</p>
          <p className="mt-2 text-sm text-muted">
            Connect a read-only Bybit API key to import closed-PnL records into your journal.
          </p>
          <Link
            href="/exchanges/new"
            className="mt-6 inline-block rounded-md bg-gold px-5 py-2 font-display tracking-widest text-black"
          >
            CONNECT BYBIT
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {connections.map((c) => (
            <li key={c.id} className="rounded-2xl border border-white/10 bg-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-xl tracking-wider text-gold">
                      {c.exchange.toUpperCase()}
                    </span>
                    <span className="rounded bg-white/10 px-2 py-0.5 text-xs uppercase text-muted">
                      {c.environment}
                    </span>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="mt-1 text-sm">{c.account_label ?? "(unlabelled)"}</p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {c.api_key_hint ?? "—"} · uid {c.external_user_id ?? "—"}
                    {c.is_master ? " · master" : ""}
                    {c.is_uta ? " · UTA" : ""}
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-right text-xs text-muted">
                    <p>connected {fmtDate(c.created_at)}</p>
                    <p>last sync {c.last_sync_at ? fmtDate(c.last_sync_at) : "—"}</p>
                  </div>
                  <form action={syncBybitAction}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="rounded-md bg-gold/20 px-4 py-2 text-xs font-display tracking-widest text-gold hover:bg-gold/30">
                      SYNC
                    </button>
                  </form>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <IpBadge ipBound={c.ip_bound} ips={c.bound_ips} />
                <PermissionsBadge perms={c.permissions} />
              </div>

              {c.last_error ? (
                <p className="mt-2 text-xs text-loss">Last error: {c.last_error}</p>
              ) : null}

              <SyncRuns runs={runsByConnection.get(c.id) ?? []} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SyncRuns({ runs }: { runs: SyncRunRow[] }) {
  if (runs.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted">No syncs yet — click SYNC to import the last 7 days.</p>
    );
  }
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-muted hover:text-white">
        Sync history ({runs.length})
      </summary>
      <ul className="mt-2 space-y-1 rounded-md border border-white/5 bg-black/30 p-2 text-xs">
        {runs.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3">
            <SyncStatusPill status={r.status} />
            <span className="text-muted">{fmtDate(r.started_at)}</span>
            <span className="text-white">{r.imported_count} imported</span>
            <span className="text-muted">{r.skipped_count} skipped</span>
            {r.error_message ? (
              <span className="text-loss">· {r.error_message}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

function StatusPill({ status }: { status: ConnectionRow["status"] }) {
  const tone: Record<ConnectionRow["status"], string> = {
    active: "bg-win/20 text-win",
    paused: "bg-white/10 text-muted",
    error: "bg-loss/20 text-loss",
    revoked: "bg-loss/20 text-loss",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs uppercase ${tone[status]}`}>{status}</span>
  );
}

function SyncStatusPill({ status }: { status: SyncRunRow["status"] }) {
  const tone: Record<SyncRunRow["status"], string> = {
    running: "bg-gold/20 text-gold",
    success: "bg-win/20 text-win",
    partial: "bg-gold/20 text-gold",
    failed: "bg-loss/20 text-loss",
  };
  return (
    <span className={`rounded px-1.5 py-0.5 ${tone[status]}`}>{status}</span>
  );
}

function IpBadge({ ipBound, ips }: { ipBound: boolean; ips: string[] }) {
  if (ipBound) {
    return (
      <span
        title={`Bybit reports IP restriction: ${ips.join(", ")}.`}
        className="rounded bg-gold/15 px-2 py-0.5 text-xs text-gold"
      >
        🔒 IP-bound
      </span>
    );
  }
  return (
    <span
      title="No IP restriction set on the key."
      className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted"
    >
      ⚠ No IP restriction
    </span>
  );
}

function PermissionsBadge({ perms }: { perms: Record<string, string[]> }) {
  const groups = Object.entries(perms ?? {})
    .filter(([, vs]) => Array.isArray(vs) && vs.length > 0)
    .map(([g]) => g);
  if (groups.length === 0) {
    return (
      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted">Read-only</span>
    );
  }
  return (
    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted">
      Scopes: {groups.join(", ")}
    </span>
  );
}

