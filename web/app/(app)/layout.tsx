import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getUnreadNotificationCountAction } from "@/lib/actions/notifications";
import DrawerNav from "./DrawerNav";
import Logo from "@/components/ui/Logo";
import { EcosystemFooter } from "@/components/ui/EcosystemFooter";
import ChatWidgetMount from "@/components/support/ChatWidgetMount";

// Auth + onboarding gate for the app shell. Every page under (app)
// requires a session AND a completed profile (display_name set).
//
// Audit H-12: the onboarding-redirect logic used to live in
// middleware.ts, which forced a DB lookup on every matched request
// (assets + APIs + page renders alike) and was bypassable via the
// /@slug rewrite (which short-circuited before the gate ran). Both
// problems gone — the gate now fires here, exactly once per page
// view, after the /@slug rewrite has resolved to its target route.
// The same `profiles` row is also used downstream for username
// derivation, so this is a single read.
//
// Admin link only renders if is_admin(auth.uid()) — non-admins never
// see the Admin nav, but the actual gate is still on /admin's server
// check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Onboarding gate. profile.display_name being non-null is the
  // signal that the user finished onboarding step 1. Send anyone
  // who skipped or is mid-flow back to /onboarding.
  if (!profile?.display_name) redirect("/onboarding");

  const admin = await isAdmin();
  const unreadRes = await getUnreadNotificationCountAction();
  const unreadCount = ("count" in unreadRes ? unreadRes.count : 0) ?? 0;

  const username =
    (profile?.username && profile.username.trim()) ||
    (profile?.display_name && profile.display_name.trim()) ||
    user.email?.split("@")[0] ||
    "Trader";

  return (
    <div className="flex min-h-screen flex-col">
      {/*
        Sticky so the brand + drawer-trigger stay reachable while
        scrolling long journal / trade / leaderboard lists. z-30 sits
        below the DrawerNav backdrop (z-40) and panel (z-50) so the
        drawer correctly overlays the header when it opens.
      */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard">
            <Logo size="md" />
          </Link>
          <DrawerNav admin={admin} unreadCount={unreadCount} userEmail={user.email ?? ""} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      <EcosystemFooter />
      <ChatWidgetMount userId={user.id} username={username} />
    </div>
  );
}
