"use client";

import { useActionState } from "react";
import type { ProfileRow } from "@/lib/types";
import { updateProfileAction, type ProfileActionState } from "./actions";

export default function ProfileForm({
  profile,
  avatarUrl,
  email,
}: {
  profile: ProfileRow | null;
  avatarUrl: string | null;
  email: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    updateProfileAction,
    {},
  );

  return (
    <form action={formAction} encType="multipart/form-data" className="space-y-5 rounded-2xl bg-panel p-6">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-black/40">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted">no avatar</div>
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs uppercase tracking-wider text-muted">Email</p>
          <p className="text-sm">{email}</p>
        </div>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Display name</span>
        <input
          name="display_name"
          required
          maxLength={40}
          defaultValue={profile?.display_name ?? profile?.name?.split(" ")[0] ?? ""}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">Shown on the leaderboard and your public page. Email is never exposed.</span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Visibility</span>
        <select
          name="visibility"
          defaultValue={profile?.visibility ?? "private"}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        >
          <option value="private">private — only you see your profile and stats</option>
          <option value="community">community — appear on leaderboard, no public share page</option>
          <option value="public">public — community + a public /p/{profile?.id ?? "you"} share page</option>
        </select>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muted">Starting balance ($)</span>
        <input
          name="starting_balance"
          type="number"
          step="0.01"
          min="0"
          defaultValue={profile?.starting_balance ?? ""}
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2"
        />
        <span className="mt-1 block text-xs text-muted">Used to compute growth %. Required for the quality leaderboard.</span>
      </label>

      <div className="space-y-2">
        <span className="block text-sm text-muted">Avatar</span>
        <input
          type="file"
          name="avatar"
          accept="image/jpeg,image/png,image/webp"
          className="block w-full text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-gold/20 file:px-3 file:py-1.5 file:text-xs file:font-display file:tracking-widest file:text-gold hover:file:bg-gold/30"
        />
        <p className="text-xs text-muted">Max 2 MB. JPEG / PNG / WebP. Stored privately; signed URL minted on each render.</p>
      </div>

      {state.error ? <p className="text-sm text-loss">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-win">{state.ok}</p> : null}

      <div className="flex justify-end">
        <button
          disabled={pending}
          className="rounded-md bg-gold px-6 py-2 font-display tracking-widest text-black disabled:opacity-50"
        >
          {pending ? "SAVING…" : "SAVE PROFILE"}
        </button>
      </div>
    </form>
  );
}
