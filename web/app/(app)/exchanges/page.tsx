import { Plus, Lock, AlertTriangle, RefreshCw } from "lucide-react";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { fmtDate } from "@/lib/format";
import {
  PageHeader,
  LinkButton,
  Button,
  EmptyState,
  StatusPill,
} from "@/components/ui";
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
  await requireAdmin();
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
      <PageHeader
        title="Exchanges"
        description="Connect read-only Bybit API keys to import closed-PnL records into your journal."
        action={
          connections.length > 0 ? (
            <LinkButton href="/exchanges/new" icon={<Plus size={14} aria-hidden />}>
              Connect
            </LinkButton>
          ) : null
        }
      />

      {error ? <p className="text-sm text-loss">{error.message}</p> : null}

      {connections.length === 0 ? (
        <EmptyState
          title="No connections yet"
          description="Connect a read-only Bybit API key to import closed-PnL records into your journal."
          action={
            <LinkButton href="/exchanges/new" icon={<Plus size={14} aria-hidden />}>
              Connect Bybit
            </LinkButton>
          }
        />
      ) : (
        <ul className="space-y-3">
          {connections.map((c) => (
            <li key={c.id} className="rounded-lg border border-white/10 bg-panel p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-white">
                      {c.exchange === "bybit" ? "Bybit" : c.exchange}
                    </span>
                    <StatusPill tone="neutral">
                      {c.environment === "mainnet" ? "Mainnet" : "Testnet"}
                    </StatusPill>
                    <ConnStatusPill status={c.status} />
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
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      icon={<RefreshCw size={12} aria-hidden />}
                    >
                      Sync
                    </Button>
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
      <p className="mt-3 text-xs text-muted">
        No syncs yet — click Sync to import the last 7 days.
      </p>
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

function ConnStatusPill({ status }: { status: ConnectionRow["status"] }) {
  const tone =
    status === "active"
      ? "ok"
      : status === "error" || status === "revoked"
        ? "error"
        : "neutral";
  const label =
    status === "active"
      ? "Active"
      : status === "paused"
        ? "Paused"
        : status === "error"
          ? "Error"
          : "Revoked";
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

function SyncStatusPill({ status }: { status: SyncRunRow["status"] }) {
  const tone =
    status === "success" ? "ok" : status === "failed" ? "error" : "info";
  return <StatusPill tone={tone}>{status}</StatusPill>;
}

function IpBadge({ ipBound, ips }: { ipBound: boolean; ips: string[] }) {
  if (ipBound) {
    return (
      <span title={`Bybit reports IP restriction: ${ips.join(", ")}.`}>
        <StatusPill tone="info" icon={<Lock size={12} aria-hidden />}>
          IP-bound
        </StatusPill>
      </span>
    );
  }
  return (
    <span title="No IP restriction set on the key.">
      <StatusPill tone="warn" icon={<AlertTriangle size={12} aria-hidden />}>
        No IP restriction
      </StatusPill>
    </span>
  );
}

function PermissionsBadge({ perms }: { perms: Record<string, string[]> }) {
  const groups = Object.entries(perms ?? {})
    .filter(([, vs]) => Array.isArray(vs) && vs.length > 0)
    .map(([g]) => g);
  if (groups.length === 0) {
    return <StatusPill tone="neutral">Read-only</StatusPill>;
  }
  return <StatusPill tone="neutral">Scopes: {groups.join(", ")}</StatusPill>;
}
