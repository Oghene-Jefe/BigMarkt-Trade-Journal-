"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { profileVisibility, journalMode, usernameSchema } from "@/lib/schemas";
import { extForSniffedType, sniffImageType } from "@/lib/upload/imageSniff";
import { safeDbError } from "@/lib/db-error";

export type ProfileActionState = { error?: string; ok?: string };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const updateSchema = z.object({
  display_name: z.string().min(1).max(40).transform((s) => s.trim()),
  visibility: profileVisibility,
  journal_mode: journalMode,
  username: usernameSchema.nullable().optional(),
  starting_balance: z.number().finite().nonnegative().nullable(),
  auto_share_verified: z.boolean(),
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
    journal_mode: fd.get("journal_mode") ?? "manual",
    username: fd.get("username") ? String(fd.get("username")).toLowerCase().trim() : null,
    starting_balance: Number.isFinite(startBal) ? startBal : null,
    auto_share_verified: fd.get("auto_share_verified") === "on",
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
  // Audit M-5: generic message; full error logged server-side.
  if (error) return { error: safeDbError(error, "Couldn't save your profile. Try again.", "profile_update") };

  // Handle optional avatar upload as part of the same form submit.
  const file = fd.get("avatar") as File | null;
  if (file && file.size > 0) {
    if (file.size > MAX_AVATAR_BYTES) return { error: "Avatar too large (2 MB max)." };

    // Magic-byte sniff — don't trust browser-reported file.type or the
    // user-supplied filename. The detected type drives both storage
    // Content-Type and the file extension.
    const sniffed = await sniffImageType(file);
    if (!sniffed) return { error: "Avatar must be a JPEG, PNG, or WebP image." };

    const path = `${user.id}/avatar-${Date.now()}.${extForSniffedType(sniffed)}`;

    // Look up existing path so we can delete the old object after upload.
    const { data: existing } = await sb.from("profiles")
      .select("avatar_path").eq("id", user.id).maybeSingle();

    const { error: upErr } = await sb.storage
      .from("avatars")
      .upload(path, file, { contentType: sniffed, upsert: false });
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

// One-shot backfill: flip all private verified closed EA trades to followers_only.
// Idempotent — the WHERE guard means re-running only touches still-private rows.
export async function backfillVerifiedVisibilityAction(): Promise<{ ok?: string; error?: string }> {
  const { sb, user } = await requireUser();
  const { error } = await sb
    .from("trades")
    .update({ visibility: "followers_only" })
    .eq("user_id", user.id)
    .eq("source", "ea")
    .eq("verified", true)
    .eq("trust_badge", "auto_verified")
    .eq("status", "closed")
    .eq("visibility", "private");

  if (error) return { error: safeDbError(error, "Couldn't share trades. Try again.", "backfill_visibility") };
  revalidatePath("/profile");
  revalidatePath("/feed");
  return { ok: "Done — your verified trades are now visible to your followers." };
}
