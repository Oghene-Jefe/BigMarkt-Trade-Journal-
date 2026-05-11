import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { logoutAction } from "../(auth)/actions";

// Auth gate for the app shell. Every page under (app) requires a session.
// Admin link only renders if is_admin(auth.uid()) — non-admins never see
// the Admin nav, but the actual gate is still on /admin's server check.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const admin = await isAdmin();

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/10 bg-panel">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="font-display text-2xl tracking-widest text-gold">
            BIGMARKT
          </Link>
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/dashboard" className="text-muted hover:text-white">Dashboard</Link>
            <Link href="/journal" className="text-muted hover:text-white">Journal</Link>
            <Link href="/analytics" className="text-muted hover:text-white">Analytics</Link>
            <Link href="/challenges" className="text-muted hover:text-white">Challenges</Link>
            <Link href="/leaderboard" className="text-muted hover:text-white">Leaderboard</Link>
            <Link href="/brokers" className="text-muted hover:text-white">Broker Guide</Link>
            <Link href="/exchanges" className="text-muted hover:text-white">Exchanges</Link>
            <Link href="/profile" className="text-muted hover:text-white">Profile</Link>
            {admin ? <Link href="/admin" className="text-gold hover:text-white">Admin</Link> : null}
            <span className="hidden text-xs text-muted md:inline">{user.email}</span>
            <form action={logoutAction}>
              <button className="rounded-md border border-white/20 px-3 py-1 text-xs">Log out</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
