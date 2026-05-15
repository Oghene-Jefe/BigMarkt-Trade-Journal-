import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { getUnreadNotificationCountAction } from "@/lib/actions/notifications";
import DrawerNav from "./DrawerNav";
import Logo from "@/components/ui/Logo";
import ChatWidgetMount from "@/components/support/ChatWidgetMount";

// Auth gate for the app shell. Every page under (app) requires a session.
// Admin link only renders if is_admin(auth.uid()) — non-admins never see
// the Admin nav, but the actual gate is still on /admin's server check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const admin = await isAdmin();
  const unreadRes = await getUnreadNotificationCountAction();
  const unreadCount = ("count" in unreadRes ? unreadRes.count : 0) ?? 0;

  const { data: profile } = await sb
    .from("profiles")
    .select("username, display_name")
    .eq("id", user.id)
    .maybeSingle();
  const username =
    (profile?.username && profile.username.trim()) ||
    (profile?.display_name && profile.display_name.trim()) ||
    user.email?.split("@")[0] ||
    "Trader";

  return (
    <div className="min-h-screen">
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
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <ChatWidgetMount userId={user.id} username={username} />
    </div>
  );
}
