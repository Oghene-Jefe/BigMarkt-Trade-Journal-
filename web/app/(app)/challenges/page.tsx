import { supabaseServer } from "@/lib/supabase/server";
import type { ChallengeRow } from "@/lib/types";
import { fmtMoney, fmtDate } from "@/lib/format";
import NewChallengeForm from "./NewChallengeForm";
import { setChallengeStatusAction, deleteChallengeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  const sb = await supabaseServer();
  const { data } = await sb.from("challenges")
    .select("*")
    .order("created_at", { ascending: false });
  const challenges = (data ?? []) as ChallengeRow[];

  const active = challenges.filter((c) => c.status === "active");
  const finished = challenges.filter((c) => c.status !== "active");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-widest text-gold">CHALLENGES</h1>

      <NewChallengeForm />

      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-widest text-gold">ACTIVE ({active.length})</h2>
        {active.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-panel p-6 text-sm text-muted">
            No active challenges. Set one above to track a goal with a deadline.
          </p>
        ) : (
          <ul className="space-y-2">
            {active.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
          </ul>
        )}
      </section>

      {finished.length > 0 ? (
        <section className="space-y-3">
          <h2 className="font-display text-xl tracking-widest text-muted">HISTORY ({finished.length})</h2>
          <ul className="space-y-2">
            {finished.map((c) => <ChallengeCard key={c.id} challenge={c} historical />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ChallengeCard({ challenge: c, historical }: { challenge: ChallengeRow; historical?: boolean }) {
  const statusColor: Record<string, string> = {
    active: "bg-gold/20 text-gold",
    completed: "bg-win/20 text-win",
    failed: "bg-loss/20 text-loss",
    abandoned: "bg-white/10 text-muted",
  };

  return (
    <li className={`rounded-2xl border border-white/10 bg-panel p-4 ${historical ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`rounded px-2 py-0.5 text-xs ${statusColor[c.status ?? "active"] ?? ""}`}>
              {c.status ?? "active"}
            </span>
            <h3 className="font-medium">{c.goal_type ?? "Unnamed"}</h3>
          </div>
          <p className="mt-1 text-sm text-muted">
            Target: <span className="text-white">{fmtMoney(c.goal_target)}</span>
            {c.start_date ? ` · ${fmtDate(c.start_date)}` : ""}
            {c.end_date ? ` → ${fmtDate(c.end_date)}` : ""}
          </p>
          {c.current_streak ? (
            <p className="mt-1 text-xs text-muted">
              Current streak: {c.current_streak}{c.longest_streak ? ` · best ${c.longest_streak}` : ""}
              {c.badge_earned ? ` · ${c.badge_earned}` : ""}
            </p>
          ) : null}
        </div>

        {!historical ? (
          <div className="flex items-center gap-2">
            <form action={setChallengeStatusAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="status" value="completed" />
              <button className="rounded border border-win/40 px-2 py-1 text-xs text-win hover:bg-win/10">
                Complete
              </button>
            </form>
            <form action={setChallengeStatusAction}>
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="status" value="abandoned" />
              <button className="rounded border border-white/20 px-2 py-1 text-xs text-muted hover:bg-white/5">
                Abandon
              </button>
            </form>
          </div>
        ) : (
          <form action={deleteChallengeAction}>
            <input type="hidden" name="id" value={c.id} />
            <button className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10">
              Delete
            </button>
          </form>
        )}
      </div>
    </li>
  );
}
