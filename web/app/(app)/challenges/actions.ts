"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { challengeSchema, challengeStatus } from "@/lib/schemas";
import { safeDbError } from "@/lib/db-error";

export type ChallengeActionState = { error?: string; ok?: string };

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

export async function createChallengeAction(_: ChallengeActionState, fd: FormData): Promise<ChallengeActionState> {
  const parsed = challengeSchema.safeParse({
    goal_type: fd.get("goal_type"),
    goal_target: Number(fd.get("goal_target")),
    start_date: fd.get("start_date"),
    end_date: fd.get("end_date"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your inputs." };
  }

  const { sb, user } = await requireUser();
  const { error } = await sb.from("challenges").insert({
    user_id: user.id,
    goal_type: parsed.data.goal_type,
    goal_target: parsed.data.goal_target,
    start_date: parsed.data.start_date,
    end_date: parsed.data.end_date,
    status: "active",
  });
  if (error) return { error: safeDbError(error, "Couldn't create challenge.", "challenge_insert") };

  revalidatePath("/challenges");
  return { ok: "Challenge created." };
}

const statusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: challengeStatus,
});

export async function setChallengeStatusAction(fd: FormData) {
  const parsed = statusUpdateSchema.safeParse({
    id: fd.get("id"),
    status: fd.get("status"),
  });
  if (!parsed.success) return;

  const { sb, user } = await requireUser();
  const completedAt = parsed.data.status === "completed" ? new Date().toISOString() : null;

  await sb.from("challenges")
    .update({ status: parsed.data.status, completed_at: completedAt })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  revalidatePath("/challenges");
}

export async function deleteChallengeAction(fd: FormData) {
  const id = fd.get("id");
  if (typeof id !== "string") return;
  const { sb, user } = await requireUser();
  await sb.from("challenges").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/challenges");
}
