import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="font-display text-6xl tracking-wider text-gold">BIG<span className="text-white">M</span>RKT</h1>
        <p className="mt-2 text-sm uppercase tracking-[0.3em] text-muted">FTS Trade Journal</p>
      </div>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-md bg-gold px-6 py-3 font-display tracking-widest text-black">LOG IN</Link>
        <Link href="/signup" className="rounded-md border border-white/20 px-6 py-3 font-display tracking-widest">SIGN UP</Link>
      </div>
    </main>
  );
}
