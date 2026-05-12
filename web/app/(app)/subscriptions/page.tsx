import Link from "next/link";
import type { Route } from "next";
import { signAvatars } from "@/lib/storage";
import ConfirmButton from "@/components/ConfirmButton";
import {
  getMySubscriptionsAction,
  unfollowFromFormAction,
  toggleSubscriptionStatusFormAction,
} from "@/lib/actions/subscriptions";

export const dynamic = "force-dynamic";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function SubscriptionsPage() {
  const result = await getMySubscriptionsAction();
  const isError = !Array.isArray(result);
  const subs = Array.isArray(result) ? result : [];
  const paths = subs
    .map((s) => s.leader_avatar_path)
    .filter((p): p is string => !!p);
  const avatars = await signAvatars(paths);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl tracking-widest text-gold">MY SUBSCRIPTIONS</h1>

      {isError ? (
        <p className="text-sm text-loss">
          Couldn't load subscriptions: {(result as { error: string }).error}
        </p>
      ) : null}

      {!isError && subs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-panel p-12 text-center">
          <p className="font-display text-2xl tracking-widest text-gold">NO SUBSCRIPTIONS</p>
          <p className="mt-2 text-sm text-muted">
            You are not following any leaders yet. Visit the leaderboard to find leaders.
          </p>
          <Link
            href="/leaderboard"
            className="mt-4 inline-block rounded-md border border-gold/40 px-4 py-2 text-xs font-display tracking-widest text-gold hover:bg-gold/10"
          >
            BROWSE LEADERBOARD
          </Link>
        </div>
      ) : null}

      {subs.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {subs.map((s) => {
            const href = (s.leader_username
              ? `/@${s.leader_username}`
              : `/p/${s.leader_id}`) as Route;
            const avatarUrl = s.leader_avatar_path ? avatars[s.leader_avatar_path] : null;
            const isExecution = s.mode === "execution";
            const isActive = s.status === "active";
            const isPaused = s.status === "paused";
            const minGradeLabel =
              s.min_signal_grade === "any"
                ? "Any grade"
                : `Min grade: ${s.min_signal_grade}`;

            return (
              <li
                key={s.id}
                className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-panel p-5 shadow-lg shadow-black/40"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/15 bg-black/60">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="font-display text-sm tracking-wider text-gold">
                        {initials(s.leader_display_name)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={href}
                      className="block truncate text-lg font-bold text-white hover:text-gold"
                    >
                      {s.leader_display_name ?? "Anonymous"}
                    </Link>
                    <p className="text-xs text-muted">{minGradeLabel}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-display tracking-widest ${
                      isExecution
                        ? "bg-gold/15 text-gold ring-1 ring-inset ring-gold/40"
                        : "bg-white/5 text-muted ring-1 ring-inset ring-white/15"
                    }`}
                  >
                    {isExecution ? "EXECUTION" : "JOURNAL ONLY"}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-display tracking-widest ${
                      isActive
                        ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30"
                        : isPaused
                        ? "bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-400/30"
                        : "bg-white/5 text-muted ring-1 ring-inset ring-white/15"
                    }`}
                  >
                    {s.status.toUpperCase()}
                  </span>
                </div>

                {s.leader_also_follows ? (
                  <p className="rounded-md border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                    ⚠️ This leader also follows others
                  </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-2">
                  <form action={toggleSubscriptionStatusFormAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <input
                      type="hidden"
                      name="next"
                      value={isActive ? "paused" : "active"}
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
                    >
                      {isActive ? "Pause" : "Resume"}
                    </button>
                  </form>
                  <form action={unfollowFromFormAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton
                      message={`Unfollow ${s.leader_display_name ?? "this leader"}? Any active execution will stop.`}
                      confirmLabel="Yes, unfollow"
                      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                    >
                      Unfollow
                    </ConfirmButton>
                  </form>
                  <Link
                    href={`/disputes/new?leaderId=${s.leader_id}` as Route}
                    className="ml-auto text-xs text-muted underline-offset-2 hover:text-white hover:underline"
                  >
                    Raise dispute
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
