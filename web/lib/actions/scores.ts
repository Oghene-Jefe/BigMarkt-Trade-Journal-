"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { recalculateAccountScoreWithClient } from "@/lib/scoring-recalculate";

export async function recalculateAccountScore(accountId: string) {
  const user = await requireUser();
  const sb = await supabaseServer();
  return recalculateAccountScoreWithClient(sb, user.id, accountId);
}
