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

  // Check current EA trades visibility (peek at first EA trade)
  const { data: sample } = await sb
    .from("trades")
    .select("visibility")
    .eq("user_id", user.id)
    .eq("source", "ea")
    .limit(1)
    .maybeSingle();

  const eaPublic = sample?.visibility === "community";

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
