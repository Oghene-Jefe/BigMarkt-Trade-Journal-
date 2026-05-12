"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import type { Notification } from "@/lib/types";

export async function getMyNotificationsAction(): Promise<
  Notification[] | { error: string }
> {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { data, error } = await sb
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return { error: error.message };
  return (data ?? []) as Notification[];
}

export async function markNotificationReadAction(notificationId: string) {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { error } = await sb
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  return { success: true as const };
}

export async function markAllNotificationsReadAction() {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { error } = await sb
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) return { error: error.message };
  return { success: true as const };
}

export async function getUnreadNotificationCountAction() {
  const user = await requireUser();
  const sb = await supabaseServer();

  const { count, error } = await sb
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (error) return { error: error.message };
  return { count: count ?? 0 };
}
