import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import EaVisibilityToggle from "./EaVisibilityToggle";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect("/login");

  // On when any EA trade is public. ("community" is not a trade visibility
  // value: trades_visibility_check allows private / public / exclude /
  // followers_only, so the old check always showed Off.)
  const { data: publicEa } = await sb
    .from("trades")
    .select("id")
    .eq("user_id", user.id)
    .eq("source", "ea")
    .eq("visibility", "public")
    .limit(1);

  const eaPublic = (publicEa ?? []).length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" />

      <section className="rounded-lg border border-white/10 bg-panel p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">EA Trade Visibility</h2>

        <EaVisibilityToggle initialValue={eaPublic} />
      </section>
    </div>
  );
}
