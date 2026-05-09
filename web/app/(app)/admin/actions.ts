"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

const idSchema = z.object({ id: z.string().uuid() });

export async function adminDeleteUserAction(fd: FormData) {
  // Belt-and-braces: server-side admin check before even calling the RPC.
  // The RPC also re-checks via is_admin(auth.uid()) at the database level.
  if (!(await isAdmin())) return;

  const parsed = idSchema.safeParse({ id: fd.get("id") });
  if (!parsed.success) return;

  const sb = await supabaseServer();
  await sb.rpc("admin_delete_user", { target_id: parsed.data.id });
  revalidatePath("/admin");
}
