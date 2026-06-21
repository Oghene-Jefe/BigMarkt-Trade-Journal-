import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

// Shared fire-and-forget notification writer. Never throws — failures are
// logged. Callers MUST NOT block their primary action on the result.
//
// Always writes via the SERVICE-ROLE client: notifications are system-generated
// for a TARGET user (e.g. a new-follower notice belongs to the leader, not the
// follower making the request), and the notifications table has only self
// SELECT/UPDATE RLS policies — no INSERT policy — so a user-session insert is
// always denied. The `_sb` param is retained for call-site compatibility but
// intentionally unused.
export async function createNotification(
  _sb: SupabaseClient,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin().from("notifications").insert({
      user_id: userId,
      type,
      title,
      body,
    });
    if (error) {
      console.error(`createNotification(${type}) failed:`, error.message);
    }
  } catch (err) {
    console.error(`createNotification(${type}) threw:`, err);
  }
}
