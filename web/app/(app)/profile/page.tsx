import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { signAvatar } from "@/lib/storage";
import type { ProfileRow, BalanceResetRow } from "@/lib/types";
import ProfileForm from "./ProfileForm";
import BalanceResetForm from "./BalanceResetForm";
import Referrals from "./Referrals";
import { fmtMoney, fmtDate } from "@/lib/format";

function refCodeFromId(id: string): string {
  return Buffer.from(id, "utf8").toString("base64").replace(/=/g, "").substring(0, 12);
}

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  const refCode = refCodeFromId(user!.id);
  const [{ data: profileData }, { data: resetsData }, refStats] = await Promise.all([
    sb.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    sb.from("balance_resets").select("*").order("created_at", { ascending: false }).limit(20),
    sb.rpc("get_referral_stats", { ref_code: refCode }),
  ]);

  const profile = (profileData ?? null) as ProfileRow | null;
  const resets = (resetsData ?? []) as BalanceResetRow[];
  const avatarUrl = profile?.avatar_path ? await signAvatar(profile.avatar_path) : null;

  // get_referral_stats returns json — accept either { count } or a number.
  const rs = refStats.data as { count?: number; total?: number; active?: number } | number | null;
  const referralCount = typeof rs === "number"
    ? rs
    : (rs?.count ?? rs?.total ?? rs?.active ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">PROFILE</h1>
        {profile && (profile.visibility === "community" || profile.visibility === "public") ? (
          <Link href={`/p/${profile.id}`} className="text-xs text-muted hover:text-white">
            View public page →
          </Link>
        ) : null}
      </div>

      <ProfileForm profile={profile} avatarUrl={avatarUrl} email={user!.email ?? ""} />

      <Referrals userId={user!.id} count={referralCount} />

      <section className="space-y-3">
        <h2 className="font-display text-xl tracking-widest text-gold">BALANCE RESET</h2>
        <p className="text-xs text-muted">
          Use this when your account size changes (deposit, withdrawal, prop firm payout). Past
          trades stay attached to your old starting balance for historical accuracy; new
          analytics are computed from the latest reset.
        </p>
        <BalanceResetForm currentBalance={profile?.starting_balance ?? null} />

        {resets.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-panel">
            <table className="w-full text-sm">
              <thead className="bg-black/30 text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-right">From</th>
                  <th className="px-3 py-2 text-right">To</th>
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {resets.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="px-3 py-2 text-muted">{fmtDate(r.reset_date ?? r.created_at)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{fmtMoney(r.previous_balance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(r.new_balance)}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
