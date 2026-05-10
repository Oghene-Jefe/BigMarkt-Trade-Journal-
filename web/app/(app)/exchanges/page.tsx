import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/format";

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

export default async function ExchangesPage() {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("exchange_connections")
    .select(
      "id, exchange, environment, account_label, api_key_hint, status, ip_bound, bound_ips, permissions, last_sync_at, last_error, is_master, is_uta, external_user_id, created_at",
    )
    .order("created_at", { ascending: false });

  const connections = (data ?? []) as ConnectionRow[];

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
                <div className="text-right text-xs text-muted">
                  <p>connected {fmtDate(c.created_at)}</p>
                  <p>last sync {c.last_sync_at ? fmtDate(c.last_sync_at) : "—"}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <IpBadge ipBound={c.ip_bound} ips={c.bound_ips} />
                <PermissionsBadge perms={c.permissions} />
              </div>

              {c.last_error ? (
                <p className="mt-2 text-xs text-loss">Last error: {c.last_error}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
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

function IpBadge({ ipBound, ips }: { ipBound: boolean; ips: string[] }) {
  if (ipBound) {
    return (
      <span
        title={`Bybit reports IP restriction: ${ips.join(", ")}. Sync may fail unless the IP matches BigMarkt's egress.`}
        className="rounded bg-gold/15 px-2 py-0.5 text-xs text-gold"
      >
        🔒 IP-bound
      </span>
    );
  }
  return (
    <span
      title="No IP restriction set on the key. For better security, IP-restrict once BigMarkt has a stable sync IP."
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
      <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted">
        Read-only
      </span>
    );
  }
  return (
    <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted">
      Scopes: {groups.join(", ")}
    </span>
  );
}
