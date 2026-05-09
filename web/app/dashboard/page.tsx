import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { logoutAction } from "../(auth)/actions";

// Placeholder dashboard. Slice 2 fills this in with JournalTable + TradeForm.
export default async function DashboardPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-widest text-gold">DASHBOARD</h1>
        <form action={logoutAction}>
          <button className="rounded-md border border-white/20 px-3 py-1 text-sm">Log out</button>
        </form>
      </header>
      <p className="mt-8 text-muted">
        Signed in as <span className="text-white">{user.email}</span>. Trade journal UI lands in Slice 2.
      </p>
    </main>
  );
}
