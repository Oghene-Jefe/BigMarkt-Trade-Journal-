import { supabaseServer } from "@/lib/supabase/server";
import type { ChallengeRow } from "@/lib/types";
import { fmtMoney, fmtDate } from "@/lib/format";
import NewChallengeForm from "./NewChallengeForm";
import ConfirmButton from "@/components/ConfirmButton";
import { PageHeader, StatusPill } from "@/components/ui";
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
      <PageHeader title="Challenges" />

      <NewChallengeForm />

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-white">Active ({active.length})</h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-white/10 bg-panel p-6 text-sm text-muted">
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
          <h2 className="text-sm font-medium text-muted">History ({finished.length})</h2>
          <ul className="space-y-2">
            {finished.map((c) => <ChallengeCard key={c.id} challenge={c} historical />)}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ChallengeCard({ challenge: c, historical }: { challenge: ChallengeRow; historical?: boolean }) {
  const status = c.status ?? "active";
  const tone: "info" | "ok" | "error" | "neutral" =
    status === "completed"
      ? "ok"
      : status === "failed"
        ? "error"
        : status === "abandoned"
          ? "neutral"
          : "info";

  return (
    <li className={`rounded-lg border border-white/10 bg-panel p-4 ${historical ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <StatusPill tone={tone}>{status}</StatusPill>
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
            <ConfirmButton
              message="Delete this challenge from your history?"
              className="rounded border border-loss/40 px-2 py-1 text-xs text-loss hover:bg-loss/10"
            >
              Delete
            </ConfirmButton>
          </form>
        )}
      </div>
    </li>
  );
}
