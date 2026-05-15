import TradeForm from "@/components/TradeForm";
import { PageHeader } from "@/components/ui";
import { createTradeAction } from "../../actions";

export default function NewTradePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="New trade" />
      <TradeForm action={createTradeAction} submitLabel="Log trade" />
    </div>
  );
}
