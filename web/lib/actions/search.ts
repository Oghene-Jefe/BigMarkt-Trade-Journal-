"use server";
import { requireUser } from "@/lib/auth/require-user";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatars } from "@/lib/storage";

export type ProfileResult = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  visibility: string | null;
  is_leader: boolean;
};

type ProfileRow = Omit<ProfileResult, "avatar_url"> & {
  avatar_path: string | null;
};

// Search community/public profiles by display_name or username. The RPC is
// SECURITY DEFINER and hard-filters to community/public only (never private)
// and excludes the caller. Returns [] for queries under 2 chars (enforced in
// the RPC) so the UI can call freely without guarding length itself.
export async function searchProfilesAction(q: string): Promise<ProfileResult[]> {
  await requireUser();
  const term = (q ?? "").trim();
  if (term.length < 2) return [];

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("search_profiles", { q: term });
  if (error) {
    console.error("search_profiles failed", error);
    return [];
  }
  const rows = (data ?? []) as ProfileRow[];

  // Batch-sign every avatar in one round-trip.
  const paths = rows
    .map((r) => r.avatar_path)
    .filter((p): p is string => Boolean(p));
  const signed = await signAvatars(paths);

  return rows.map(({ avatar_path, ...row }) => ({
    ...row,
    avatar_url: avatar_path ? signed[avatar_path] ?? null : null,
  }));
}
