import Link from "next/link";
import type { Route } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { requireSupportAgent } from "@/lib/support-agent";
import type { SupportConversation } from "@/lib/types";

export const dynamic = "force-dynamic";

// Support desk: the same inbox as /admin/support, but for support agents, who
// have no admin menu and can't reach users, trades, payouts or disputes.
// Trader identity comes from the support_people RPC (name, email, join date
// only) — profiles RLS still refuses everything else.

type Person = {
  user_id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  member_since: string | null;
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function truncate(s: string | null, n = 60): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

const STATUS_COLOR: Record<string, string> = {
  open: "#22c55e",
  resolved: "#D4AF37",
  closed: "#6b7280",
};

export default async function SupportDeskPage() {
  await requireSupportAgent();
  const sb = await supabaseServer();

  // Only threads someone actually wrote in. The website's chat widget used to
  // create a conversation the moment it was opened, so the inbox filled with
  // empty rows that all counted as "waiting on us".
  const { data: convos } = await sb
    .from("support_conversations")
    .select("*")
    .not("last_message_at", "is", null)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const conversations = (convos ?? []) as SupportConversation[];

  const peopleById = new Map<string, Person>();
  if (conversations.length > 0) {
    const { data: people } = await sb.rpc("support_people", {
      p_conversation_ids: conversations.map((c) => c.id),
    });
    for (const p of (people ?? []) as Person[]) peopleById.set(p.user_id, p);
  }

  const openCount = conversations.filter((c) => c.status === "open").length;
  const waiting = conversations.filter((c) => c.unread_by_admin).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Support desk</h1>
        <p className="text-xs text-muted">
          Trader messages, newest first. You can reply and set status — nothing else.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Waiting on us" value={waiting} color="#D4AF37" />
        <StatBox label="Open" value={openCount} color="#22c55e" />
        <StatBox label="Total" value={conversations.length} color="#f5f5f5" />
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-panel p-10 text-center text-sm text-muted">
          No trader messages yet
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => {
            const person = peopleById.get(c.user_id);
            const display =
              person?.username || person?.display_name || person?.email?.split("@")[0] || "Trader";
            const color = STATUS_COLOR[c.status] ?? "#6b7280";
            return (
              <li key={c.id}>
                <Link
                  href={`/support-desk/${c.id}` as Route}
                  className="flex items-start gap-3 rounded-lg border border-white/10 bg-panel p-3 transition hover:border-gold/40"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#D4AF37", color: "#000000", fontWeight: 700 }}
                  >
                    {display.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{display}</span>
                      {c.unread_by_admin ? (
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: "#D4AF37" }} />
                      ) : null}
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {c.status}
                      </span>
                    </div>
                    {person?.email ? <span className="text-xs text-muted">{person.email}</span> : null}
                    <p className="mt-1 truncate text-sm text-muted">{truncate(c.last_message_preview)}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(c.last_message_at ?? c.updated_at)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}
