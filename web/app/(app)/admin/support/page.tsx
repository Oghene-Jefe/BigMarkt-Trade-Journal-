import Link from "next/link";
import type { Route } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import type { SupportConversation } from "@/lib/types";

export const dynamic = "force-dynamic";

type ConversationWithUser = SupportConversation & {
  email: string | null;
  username: string | null;
  display_name: string | null;
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

export default async function AdminSupportPage() {
  await requireAdmin();
  const sb = await supabaseServer();

  const { data: convos } = await sb
    .from("support_conversations")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  const rawConvos = (convos ?? []) as SupportConversation[];

  const userIds = Array.from(new Set(rawConvos.map((c) => c.user_id)));
  const profileMap = new Map<string, { email: string | null; username: string | null; display_name: string | null }>();
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, email, username, display_name")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, {
        email: (p.email ?? null) as string | null,
        username: (p.username ?? null) as string | null,
        display_name: (p.display_name ?? null) as string | null,
      });
    }
  }

  const conversations: ConversationWithUser[] = rawConvos.map((c) => {
    const p = profileMap.get(c.user_id);
    return {
      ...c,
      email: p?.email ?? null,
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
    };
  });

  const openCount = conversations.filter((c) => c.status === "open").length;
  const resolvedCount = conversations.filter((c) => c.status === "resolved").length;
  const totalCount = conversations.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Support inbox
        </h1>
        <p className="text-xs text-muted">All user conversations, newest first.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Open" value={openCount} color="#22c55e" />
        <StatBox label="Resolved" value={resolvedCount} color="#D4AF37" />
        <StatBox label="Total" value={totalCount} color="#f5f5f5" />
      </div>

      {conversations.length === 0 ? (
        <div className="rounded-lg border border-white/10 bg-panel p-10 text-center text-sm text-muted">
          No support conversations yet
        </div>
      ) : (
        <ul className="space-y-2">
          {conversations.map((c) => {
            const display =
              c.username || c.display_name || c.email?.split("@")[0] || "Trader";
            const initial = display.charAt(0).toUpperCase();
            const color = STATUS_COLOR[c.status] ?? "#6b7280";
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/support/${c.id}` as Route}
                  className="flex items-start gap-3 rounded-lg border border-white/10 bg-panel p-3 transition hover:border-gold/40"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#D4AF37", color: "#000000", fontWeight: 700 }}
                  >
                    {initial}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{display}</span>
                      {c.unread_by_admin ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: "#D4AF37" }}
                        />
                      ) : null}
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{ backgroundColor: `${color}22`, color }}
                      >
                        {c.status}
                      </span>
                    </div>
                    {c.email ? (
                      <span className="text-xs text-muted">{c.email}</span>
                    ) : null}
                    <p className="mt-1 truncate text-sm text-muted">
                      {truncate(c.last_message_preview)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {timeAgo(c.last_message_at ?? c.updated_at)}
                  </span>
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
      <p
        className="mt-1 text-2xl font-semibold tabular-nums"
        style={{ color }}
      >
        {value}
      </p>
    </div>
  );
}
