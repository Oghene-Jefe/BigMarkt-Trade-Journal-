import TradeForm from "@/components/TradeForm";
import { createTradeAction } from "../../actions";

export default function NewTradePage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl tracking-widest text-gold">NEW TRADE</h1>
      <TradeForm action={createTradeAction} submitLabel="LOG TRADE" />
    </div>
  );
}
