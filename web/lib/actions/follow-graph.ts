"use server";

import { supabaseServer } from "@/lib/supabase/server";
import { signAvatar } from "@/lib/storage";

export type FollowListUser = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type FollowListRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_path: string | null;
};

const MAX_ROWS = 200;

export async function getFollowListAction(
  profileId: string,
  direction: "followers" | "following",
): Promise<FollowListUser[]> {
  if (direction !== "followers" && direction !== "following") return [];

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc("get_follow_list", {
    profile_id: profileId,
    direction,
  });

  if (error) {
    console.error("get_follow_list failed", error);
    return [];
  }

  const rows = ((data ?? []) as FollowListRow[]).slice(0, MAX_ROWS);

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      username: row.username,
      display_name: row.display_name,
      avatar_url: row.avatar_path ? await signAvatar(row.avatar_path) : null,
    })),
  );
}
