import { supabaseServer } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import {
  setLeaderboardOverrideAction,
  banFromLeaderboardAction,
  clearLeaderboardOverrideAction,
} from "../actions";

export const dynamic = "force-dynamic";

// NOTE on data wiring: the existing leaderboard pipeline reads from the
// computed `account_scores` table via the leaderboard_rpc — joining
// override rows into that ranking is a non-trivial change to the RPC
// itself. For now this page surfaces the override / ban list and lets
// admins manage entries directly. Wiring overrides into the public
// leaderboard ranking is a follow-up.

type OverrideRow = {
  id: string;
  user_id: string;
  score_override: number | null;
  is_banned: boolean;
  ban_reason: string | null;
  override_reason: string | null;
  updated_at: string;
};

export default async function AdminLeaderboardPage() {
  await requireAdmin();
  const sb = await supabaseServer();

  const { data: overrides } = await sb
    .from("leaderboard_overrides")
    .select("*")
    .order("updated_at", { ascending: false });

  const rows = (overrides ?? []) as OverrideRow[];
  const ids = rows.map((r) => r.user_id);
  const profileMap = new Map<string, { username: string | null; display_name: string | null; email: string | null }>();
  if (ids.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, username, display_name, email")
      .in("id", ids);
    for (const p of (profiles ?? []) as {
      id: string;
      username: string | null;
      display_name: string | null;
      email: string | null;
    }[]) {
      profileMap.set(p.id, { username: p.username, display_name: p.display_name, email: p.email });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-widest text-gold">
          LEADERBOARD MANAGEMENT
        </h1>
        <p className="text-xs text-muted">
          Manage score overrides and bans. Overrides do not yet feed into
          the public ranking — follow-up to wire into the leaderboard RPC.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-panel p-4">
        <h2 className="mb-3 font-display text-sm tracking-widest text-gold">
          ADD / UPDATE OVERRIDE
        </h2>
        <form action={setLeaderboardOverrideAction} className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            type="text"
            name="user_id"
            required
            placeholder="user uuid"
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
          />
          <input
            type="number"
            step="0.01"
            name="score_override"
            placeholder="score override"
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
          />
          <input
            type="text"
            name="override_reason"
            placeholder="reason (optional)"
            className="rounded-md border border-white/10 bg-bg px-3 py-1.5 text-sm text-white"
          />
          <button
            type="submit"
            className="rounded-md border border-gold bg-bg px-4 py-1.5 font-display text-xs tracking-widest text-gold hover:bg-gold hover:text-black"
          >
            SAVE OVERRIDE
          </button>
        </form>
      </section>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-panel">
        <table className="w-full text-sm">
          <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-right">Override Score</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-left">Banned</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-muted">
                  No overrides or bans yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const p = profileMap.get(r.user_id);
                const display = p?.username || p?.display_name || p?.email?.split("@")[0] || r.user_id.slice(0, 8);
                return (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-3 py-2">
                      <div className="font-medium">{display}</div>
                      <div className="text-[10px] text-muted">{r.user_id}</div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.score_override != null ? r.score_override.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {r.override_reason ?? r.ban_reason ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.is_banned ? (
                        <span
                          className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider"
                          style={{ backgroundColor: "rgba(239,68,68,0.15)", color: "#ef4444" }}
                        >
                          Banned
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {!r.is_banned ? (
                          <form action={banFromLeaderboardAction}>
                            <input type="hidden" name="user_id" value={r.user_id} />
                            <input type="hidden" name="reason" value="Banned from leaderboard" />
                            <button
                              type="submit"
                              className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
                            >
                              Ban
                            </button>
                          </form>
                        ) : null}
                        <form action={clearLeaderboardOverrideAction}>
                          <input type="hidden" name="user_id" value={r.user_id} />
                          <button
                            type="submit"
                            className="rounded border border-white/20 px-2 py-1 text-xs hover:bg-white/5"
                          >
                            Clear
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
