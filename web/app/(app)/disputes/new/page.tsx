import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DisputeForm from "./DisputeForm";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewDisputePage({
  searchParams,
}: {
  searchParams: Promise<{ leaderId?: string }>;
}) {
  const { leaderId } = await searchParams;

  return (
    <div className="space-y-4">
      <Link
        href="/subscriptions"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-white"
      >
        <ArrowLeft size={12} aria-hidden />
        <span>Back to subscriptions</span>
      </Link>
      <PageHeader
        title="Raise a dispute"
        description="Disputes are reviewed by our team. False or frivolous disputes may affect your account."
      />
      <DisputeForm leaderId={leaderId ?? ""} />
    </div>
  );
}
