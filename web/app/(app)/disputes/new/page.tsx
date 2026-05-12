import Link from "next/link";
import DisputeForm from "./DisputeForm";

export const dynamic = "force-dynamic";

export default async function NewDisputePage({
  searchParams,
}: {
  searchParams: Promise<{ leaderId?: string }>;
}) {
  const { leaderId } = await searchParams;

  return (
    <div className="space-y-4">
      <Link href="/subscriptions" className="text-xs text-muted hover:text-white">
        ← Back to subscriptions
      </Link>
      <h1 className="font-display text-3xl tracking-widest text-gold">RAISE A DISPUTE</h1>
      <p className="text-sm text-muted">
        Disputes are reviewed by our team. False or frivolous disputes may affect your account.
      </p>
      <DisputeForm leaderId={leaderId ?? ""} />
    </div>
  );
}
