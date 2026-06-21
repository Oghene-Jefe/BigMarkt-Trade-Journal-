import { revalidatePath } from "next/cache";
import {
  AlertTriangle,
  Search,
  Moon,
  CheckCircle2,
  BarChart3,
  Scale,
  Bell,
  UserPlus,
  Award,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  getMyNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { fmtDate } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/ui";
import type { NotificationType } from "@/lib/types";

export const dynamic = "force-dynamic";

const ICONS: Record<NotificationType, LucideIcon> = {
  leader_suspended: AlertTriangle,
  leader_under_review: Search,
  leader_inactive: Moon,
  leader_reinstated: CheckCircle2,
  score_updated: BarChart3,
  dispute_opened: Scale,
  dispute_resolved: Scale,
  subscription_cancelled: Bell,
  new_follower: UserPlus,
  trade_approved: CheckCircle2,
  challenge_badge: Award,
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
      <PageHeader
        title="Notifications"
        action={
          notifications.length > 0 ? (
            <form action={markAllAction}>
              <button
                type="submit"
                className="rounded-md border border-white/15 px-3 py-1 text-xs text-white hover:bg-white/5"
              >
                Mark all as read
              </button>
            </form>
          ) : null
        }
      />

      {isError ? (
        <p className="text-sm text-loss">
          Couldn't load notifications: {(result as { error: string }).error}
        </p>
      ) : null}

      {!isError && notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="Follow traders to receive updates."
        />
      ) : null}

      {notifications.length > 0 ? (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            const unread = !n.read;
            return (
              <li key={n.id}>
                <form action={markOneAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button
                    type="submit"
                    className={`flex w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
                      unread
                        ? "border-l-4 border-l-gold border-white/10 bg-panel/80 hover:bg-panel"
                        : "border-white/10 bg-panel/40 opacity-60 hover:opacity-80"
                    }`}
                  >
                    <Icon size={18} aria-hidden className="mt-0.5 shrink-0 text-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-white">{n.title}</p>
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
