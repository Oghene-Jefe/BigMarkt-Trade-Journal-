import { revalidatePath } from "next/cache";
import {
  getMyNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { fmtDate } from "@/lib/format";
import type { NotificationType } from "@/lib/types";

export const dynamic = "force-dynamic";

const ICONS: Record<NotificationType, string> = {
  leader_suspended: "⚠️",
  leader_under_review: "🔍",
  leader_inactive: "💤",
  leader_reinstated: "✅",
  score_updated: "📊",
  dispute_opened: "⚖️",
  dispute_resolved: "⚖️",
  subscription_cancelled: "🔔",
  new_follower: "👤",
};

async function markAllAction() {
  "use server";
  await markAllNotificationsReadAction();
  revalidatePath("/notifications");
}

async function markOneAction(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await markNotificationReadAction(id);
  revalidatePath("/notifications");
}

export default async function NotificationsPage() {
  const result = await getMyNotificationsAction();
  const isError = !Array.isArray(result);
  const notifications = Array.isArray(result) ? result : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">NOTIFICATIONS</h1>
        {notifications.length > 0 ? (
          <form action={markAllAction}>
            <button
              type="submit"
              className="rounded-md border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
            >
              Mark all as read
            </button>
          </form>
        ) : null}
      </div>

      {isError ? (
        <p className="text-sm text-loss">
          Couldn't load notifications: {(result as { error: string }).error}
        </p>
      ) : null}

      {!isError && notifications.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-panel p-12 text-center">
          <p className="text-sm text-muted">
            No notifications yet. Follow leaders to receive updates.
          </p>
        </div>
      ) : null}

      {notifications.length > 0 ? (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const icon = ICONS[n.type] ?? "🔔";
            const unread = !n.read;
            return (
              <li key={n.id}>
                <form action={markOneAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition ${
                      unread
                        ? "border-l-4 border-l-gold border-white/10 bg-panel/80 hover:bg-panel"
                        : "border-white/10 bg-panel/40 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <span className="text-2xl leading-none">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white">{n.title}</p>
                      {n.body ? (
                        <p className="mt-1 text-sm text-muted">{n.body}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted">{fmtDate(n.created_at)}</span>
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
