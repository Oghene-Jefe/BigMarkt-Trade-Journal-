// The password form can only save with a recovery session in place, so check
// for one before showing it. Without this the form rendered for anyone who
// landed here with a dead link and only failed after they had typed a new
// password twice — which is exactly how a real reset was lost on 2026-09-25.
import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import Logo from "@/components/ui/Logo";
import NewPasswordForm from "./NewPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetConfirmPage() {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-4 rounded-lg bg-panel p-8">
          <div className="mb-6 flex justify-center">
            <Link href="/" aria-label="Back to home">
              <Logo size="lg" />
            </Link>
          </div>
          <h1 className="text-center text-2xl font-semibold text-white">Reset link didn&apos;t open</h1>
          <p className="text-sm text-muted">
            This link has expired, has already been used, or was opened in a different browser from
            the one that asked for it. Reset links only work in the browser that requested them.
          </p>
          <p className="text-sm text-muted">
            Ask for a new link and open it on the same device and browser.
          </p>
          <Link
            href="/reset"
            className="block w-full rounded-md bg-gold py-3 text-center text-sm font-medium text-black"
          >
            Send a new link
          </Link>
          <p className="text-center text-xs">
            <Link href="/login" className="text-muted hover:text-white">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return <NewPasswordForm />;
}
