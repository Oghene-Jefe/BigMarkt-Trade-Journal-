import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationType } from "@/lib/types";

// Shared fire-and-forget notification writer. Never throws — failures are
// logged. Callers MUST NOT block their primary action on the result.
export async function createNotification(
  sb: SupabaseClient,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
): Promise<void> {
  try {
    const { error } = await sb.from("notifications").insert({
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
