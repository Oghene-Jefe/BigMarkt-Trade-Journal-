import ConnectForm from "../ConnectForm";
import { PageHeader } from "@/components/ui";

export default function NewExchangePage() {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <PageHeader title="Connect exchange" />
      <ConnectForm />
    </div>
  );
}
