import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { resolveDisputeAction } from "../actions";
import { fmtDate } from "@/lib/format";
import type { Dispute } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  open:          "bg-gold/20 text-gold",
  under_review:  "bg-gold/20 text-gold",
  resolved:      "bg-win/20 text-win",
  dismissed:     "bg-loss/20 text-loss",
};

export default async function AdminDisputesPage() {
  await requireAdmin();
  const sb = await supabaseServer();

  const { data } = await sb
    .from("disputes")
    .select("*")
    .order("created_at", { ascending: false });

  const disputes = (data ?? []) as Dispute[];
  const open = disputes.filter((d) => d.status === "open" || d.status === "under_review");
  const closed = disputes.filter((d) => d.status === "resolved" || d.status === "dismissed");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-white">Disputes</h1>
        <p className="mt-1 text-sm text-muted">
          Review and resolve disputes raised against leaders.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-white">
          OPEN ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-panel p-6 text-sm text-muted">
            No open disputes.
          </p>
        ) : (
          <ul className="space-y-3">
            {open.map((d) => <DisputeCard key={d.id} dispute={d} />)}
          </ul>
        )}
      </section>

      {closed.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">
            HISTORY ({closed.length})
          </h2>
          <ul className="space-y-3">
            {closed.map((d) => <DisputeCard key={d.id} dispute={d} historical />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function DisputeCard({ dispute: d, historical }: { dispute: Dispute; historical?: boolean }) {
  return (
    <li className={`rounded-lg border border-white/10 bg-panel p-4 ${historical ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs ${STATUS_STYLES[d.status] ?? ""}`}>
              {d.status}
            </span>
            <span className="text-xs text-muted">{fmtDate(d.created_at)}</span>
          </div>
          <p className="mt-2 text-sm">
            <span className="text-muted">Reason:</span>{" "}
            <span className="text-white">{d.reason.replace(/_/g, " ")}</span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Raised by <code className="font-mono">{d.raised_by.slice(0, 8)}</code>
            {" · against "}
            <code className="font-mono">{d.leader_id.slice(0, 8)}</code>
          </p>
          <p className="mt-2 text-sm text-white/80 whitespace-pre-wrap">{d.description}</p>
          {d.evidence_url ? (
            <a
              href={d.evidence_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs text-gold underline hover:text-white"
            >
              View evidence
            </a>
          ) : null}
          {d.resolution_notes ? (
            <p className="mt-2 rounded bg-black/30 p-2 text-xs text-white/70">
              <span className="text-muted">Admin note:</span> {d.resolution_notes}
            </p>
          ) : null}
        </div>

        {!historical ? (
          <form action={resolveDisputeAction} className="flex flex-col gap-2 w-full sm:w-64">
            <input type="hidden" name="id" value={d.id} />
            <textarea
              name="note"
              rows={2}
              placeholder="Resolution note (optional)"
              className="rounded border border-white/10 bg-black/30 p-2 text-xs text-white placeholder:text-muted"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                name="resolution"
                value="resolved"
                className="flex-1 rounded border border-win/40 px-2 py-1 text-xs text-win hover:bg-win/10"
              >
                Resolve
              </button>
              <button
                type="submit"
                name="resolution"
                value="dismissed"
                className="flex-1 rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
              >
                Dismiss
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </li>
  );
}
