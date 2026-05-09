"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { profileVisibility } from "@/lib/schemas";

export type ProfileActionState = { error?: string; ok?: string };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const updateSchema = z.object({
  display_name: z.string().min(1).max(40).transform((s) => s.trim()),
  visibility: profileVisibility,
  starting_balance: z.number().finite().nonnegative().nullable(),
});

async function requireUser() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  return { sb, user };
}

export async function updateProfileAction(_: ProfileActionState, fd: FormData): Promise<ProfileActionState> {
  const startBalRaw = fd.get("starting_balance");
  const startBal = startBalRaw == null || startBalRaw === ""
    ? null
    : Number(startBalRaw);

  const parsed = updateSchema.safeParse({
    display_name: fd.get("display_name"),
    visibility: fd.get("visibility"),
    starting_balance: Number.isFinite(startBal) ? startBal : null,
  });
  if (!parsed.success) return { error: "Check your inputs." };

  const { sb, user } = await requireUser();
  // Upsert because not every account has a profile row yet — accounts created
  // via the new signup flow before migration 0009 landed don't have one.
  const { error } = await sb.from("profiles").upsert({
    id: user.id,
    email: user.email,
    ...parsed.data,
  });
  if (error) return { error: error.message };

  // Handle optional avatar upload as part of the same form submit.
  const file = fd.get("avatar") as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_AVATAR_BYTES) return { error: "Avatar too large (2 MB max)." };
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) return { error: "Avatar must be JPEG / PNG / WebP." };

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;

    // Look up existing path so we can delete the old object after upload.
    const { data: existing } = await sb.from("profiles")
      .select("avatar_path").eq("id", user.id).maybeSingle();

    const { error: upErr } = await sb.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) return { error: `Avatar upload failed: ${upErr.message}` };

    await sb.from("profiles").upsert({ id: user.id, email: user.email, avatar_path: path });
    if (existing?.avatar_path && existing.avatar_path !== path) {
      await sb.storage.from("avatars").remove([existing.avatar_path]);
    }
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  return { ok: "Profile saved." };
}
