import Link from "next/link";
import type { Route } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { banUserAction, unbanUserAction } from "../actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type ProfileRow = {
  id: string;
  email: string | null;
  username: string | null;
  display_name: string | null;
  created_at: string | null;
  is_banned: boolean | null;
  banned_reason: string | null;
};

type Filter = "all" | "banned" | "verified";

function parseFilter(v: string | string[] | undefined): Filter {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "banned" || s === "verified") return s;
  return "all";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    search?: string | string[];
    filter?: string | string[];
    page?: string | string[];
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const search = (Array.isArray(sp.search) ? sp.search[0] : sp.search) ?? "";
  const filter = parseFilter(sp.filter);
  const pageNum = Math.max(
    1,
    parseInt(String(Array.isArray(sp.page) ? sp.page[0] : sp.page ?? "1"), 10) || 1,
  );

  const sb = await supabaseServer();
  let q = sb
    .from("profiles")
    .select(
      "id, email, username, display_name, created_at, is_banned, banned_reason",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (filter === "banned") q = q.eq("is_banned", true);
  if (filter === "verified") q = q.not("username", "is", null);
  if (search) {
    const term = search.replace(/[%_]/g, "");
    q = q.or(
      `email.ilike.%${term}%,username.ilike.%${term}%,display_name.ilike.%${term}%`,
    );
  }

  const from = (pageNum - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const { data, count } = await q.range(from, to);

  const users = (data ?? []) as ProfileRow[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Per-user trade counts via a single rollup query.
  const ids = users.map((u) => u.id);
  const tradeCountMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: tradeRows } = await sb
      .from("trades")
      .select("user_id")
      .in("user_id", ids);
    for (const r of (tradeRows ?? []) as { user_id: string }[]) {
      tradeCountMap.set(r.user_id, (tradeCountMap.get(r.user_id) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-widest text-gold">
          USER MANAGEMENT
        </h1>
        <p className="text-xs text-muted">
          {total} users · page {pageNum} of {totalPages}
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="filter" value={filter} />
        <label className="flex flex-col gap-1 text-xs text-muted">
          Search
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="username, name, or email"
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white outline-none focus:border-gold/40"
          />
        </label>
        <button
          type="submit"
          className="rounded-md border border-gold bg-bg px-4 py-1.5 font-display text-xs tracking-widest text-gold hover:bg-gold hover:text-black"
        >
          SEARCH
        </button>
      </form>

      <div className="flex gap-2">
        {(["all", "banned", "verified"] as Filter[]).map((f) => (
          <Link
            key={f}
            href={`/admin/users?filter=${f}${search ? `&search=${encodeURIComponent(search)}` : ""}` as Route}
            className={`rounded-full px-4 py-1.5 font-display text-xs tracking-widest ${
              filter === f
                ? "bg-gold text-black"
                : "border border-white/10 bg-panel text-muted hover:text-white"
            }`}
          >
            {f.toUpperCase()}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-right">Trades</th>
              <th className="px-3 py-2 text-left">Joined</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-sm text-muted">
                  No users match.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const display = u.username || u.display_name || u.email?.split("@")[0] || "Trader";
                const initial = display.charAt(0).toUpperCase();
                const banned = !!u.is_banned;
                return (
                  <tr key={u.id} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: "#D4AF37", color: "#000", fontWeight: 700, fontSize: 12 }}
                      >
                        {initial}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-white">{display}</div>
                      {u.display_name && u.display_name !== display ? (
                        <div className="text-xs text-muted">{u.display_name}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{u.email ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {tradeCountMap.get(u.id) ?? 0}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{fmtDate(u.created_at)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: banned ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
                          color: banned ? "#ef4444" : "#22c55e",
                        }}
                      >
                        {banned ? "Banned" : "Active"}
                      </span>
                      {banned && u.banned_reason ? (
                        <div className="mt-1 text-[10px] text-muted">{u.banned_reason}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/trades?user=${u.id}` as Route}
                          className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5"
                        >
                          Trades
                        </Link>
                        <form action={banned ? unbanUserAction : banUserAction}>
                          <input type="hidden" name="id" value={u.id} />
                          {!banned ? (
                            <input
                              type="hidden"
                              name="reason"
                              value="Banned by admin"
                            />
                          ) : null}
                          <button
                            type="submit"
                            className={`rounded border px-2 py-1 text-xs ${
                              banned
                                ? "border-gold/40 text-gold hover:bg-gold/10"
                                : "border-loss/40 text-loss hover:bg-loss/10"
                            }`}
                          >
                            {banned ? "Unban" : "Ban"}
                          </button>
                        </form>
                        <ImpersonateButton id={u.id} />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <Link
          href={`/admin/users?filter=${filter}&page=${Math.max(1, pageNum - 1)}${search ? `&search=${encodeURIComponent(search)}` : ""}` as Route}
          className={`rounded border border-white/10 px-3 py-1 ${pageNum <= 1 ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`}
        >
          ← Prev
        </Link>
        <span>
          Page {pageNum} / {totalPages}
        </span>
        <Link
          href={`/admin/users?filter=${filter}&page=${Math.min(totalPages, pageNum + 1)}${search ? `&search=${encodeURIComponent(search)}` : ""}` as Route}
          className={`rounded border border-white/10 px-3 py-1 ${pageNum >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-white/5"}`}
        >
          Next →
        </Link>
      </div>
    </div>
  );
}

function ImpersonateButton({ id }: { id: string }) {
  // Placeholder. Real impersonation needs the service-role key and is
  // intentionally not implemented in this client. Logs the intent only.
  return (
    <form
      action={async () => {
        "use server";
        console.log(`[admin] impersonate ${id} (not implemented)`);
      }}
    >
      <button
        type="submit"
        title="Impersonation not yet available"
        className="rounded border border-white/10 px-2 py-1 text-xs text-muted opacity-60"
      >
        Impersonate
      </button>
    </form>
  );
}
