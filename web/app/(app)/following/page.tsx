import Link from "next/link";
import type { Route } from "next";
import { signAvatars } from "@/lib/storage";
import ConfirmButton from "@/components/ConfirmButton";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import {
  getMySubscriptionsAction,
  unfollowFromFormAction,
} from "@/lib/actions/subscriptions";

export const dynamic = "force-dynamic";

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default async function FollowingPage() {
  const result = await getMySubscriptionsAction();
  const isError = !Array.isArray(result);
  const subs = Array.isArray(result) ? result : [];
  const paths = subs
    .map((s) => s.leader_avatar_path)
    .filter((p): p is string => !!p);
  const avatars = await signAvatars(paths);

  return (
    <div className="space-y-4">
      <PageHeader title="Following" />

      {isError ? (
        <p className="text-sm text-loss">
          Couldn't load your following list: {(result as { error: string }).error}
        </p>
      ) : null}

      {!isError && subs.length === 0 ? (
        <EmptyState
          title="Not following anyone yet"
          description="You are not following any traders yet. Visit the leaderboard to find traders."
          action={
            <LinkButton href="/leaderboard" variant="secondary">
              Browse leaderboard
            </LinkButton>
          }
        />
      ) : null}

      {subs.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {subs.map((s) => {
            const href = (s.leader_username
              ? `/@${s.leader_username}`
              : `/p/${s.leader_id}`) as Route;
            const avatarUrl = s.leader_avatar_path ? avatars[s.leader_avatar_path] : null;

            return (
              <li
                key={s.id}
                className="flex flex-col gap-4 rounded-lg border border-white/10 bg-panel p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white/15 bg-black/60">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL, re-issued per render
                      <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm font-medium text-gold">
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
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2">
                  <form action={unfollowFromFormAction}>
                    <input type="hidden" name="id" value={s.id} />
                    <ConfirmButton
                      message={`Unfollow ${s.leader_display_name ?? "this leader"}? You'll stop seeing this trader's verified trades.`}
                      confirmLabel="Yes, unfollow"
                      className="rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                    >
                      Unfollow
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
