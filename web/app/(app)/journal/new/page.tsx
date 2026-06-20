import TradeForm from "@/components/TradeForm";
import { PageHeader } from "@/components/ui";
import { supabaseServer } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/require-user";
import { getActiveAccount } from "@/lib/accounts";
import { createTradeAction } from "../../actions";

export default async function NewTradePage() {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { activeId, accounts } = await getActiveAccount(sb, user.id);

  return (
    <div className="space-y-4">
      <PageHeader title="New trade" />
      <TradeForm
        action={createTradeAction}
        submitLabel="Log trade"
        accounts={accounts}
        defaultAccountId={activeId}
      />
    </div>
  );
}
