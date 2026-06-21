import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import Logo from "@/components/ui/Logo";

export const dynamic = "force-dynamic";

export default async function Home() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12 text-center text-white">
      <Logo size="xl" />
      <p className="mt-6 text-base text-muted sm:text-lg">
        The verified trading journal.
      </p>
      <div className="mt-8 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
        <Link
          href="/signup"
          className="rounded-md bg-gold px-6 py-3 text-center text-sm font-medium text-black hover:bg-gold/90 sm:w-auto"
        >
          Create account
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-gold px-6 py-3 text-center text-sm font-medium text-gold hover:bg-gold/10 sm:w-auto"
        >
          Log in
        </Link>
      </div>
      <a
        href="https://bigmarkt.co"
        target="_blank"
        rel="noopener"
        className="mt-10 text-xs uppercase tracking-[0.25em] text-muted hover:text-white"
      >
        Learn more at bigmarkt.co
      </a>
    </main>
  );
}
