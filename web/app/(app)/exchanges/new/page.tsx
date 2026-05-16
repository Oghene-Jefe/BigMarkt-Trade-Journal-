import { requireAdmin } from "@/lib/admin";
import ConnectForm from "../ConnectForm";
import { PageHeader } from "@/components/ui";

export default async function NewExchangePage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Connect exchange" />
      <ConnectForm />
    </div>
  );
}
