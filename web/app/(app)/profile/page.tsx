import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatar } from "@/lib/storage";
import type { ProfileRow } from "@/lib/types";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const { data } = await sb.from("profiles").select("*").eq("id", user!.id).maybeSingle();
  const profile = (data ?? null) as ProfileRow | null;
  const avatarUrl = profile?.avatar_path ? await signAvatar(profile.avatar_path) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">PROFILE</h1>
        {profile && (profile.visibility === "community" || profile.visibility === "public") ? (
          <Link href={`/p/${profile.id}`} className="text-xs text-muted hover:text-white">
            View public page →
          </Link>
        ) : null}
      </div>
      <ProfileForm profile={profile} avatarUrl={avatarUrl} email={user!.email ?? ""} />
    </div>
  );
}
