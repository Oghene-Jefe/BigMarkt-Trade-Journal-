import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import OnboardingWizard from "./OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("display_name, username, journal_mode, visibility")
    .eq("id", user.id)
    .maybeSingle();

  const emailPrefix = (user.email ?? "").split("@")[0] ?? "";

  return (
    <OnboardingWizard
      initialEmailPrefix={emailPrefix}
      initialDisplayName={profile?.display_name ?? ""}
      initialUsername={profile?.username ?? ""}
      initialJournalMode={(profile?.journal_mode as "manual" | "automated" | null) ?? "manual"}
      initialVisibility={(profile?.visibility as "private" | "community" | "public" | null) ?? "community"}
    />
  );
}
