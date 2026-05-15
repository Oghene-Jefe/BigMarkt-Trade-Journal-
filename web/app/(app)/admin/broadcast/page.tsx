import { AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/admin";
import BroadcastForm from "./BroadcastForm";

export const dynamic = "force-dynamic";

export default async function AdminBroadcastPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">
          Broadcast announcement
        </h1>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-300">
        <AlertTriangle size={16} aria-hidden className="mt-0.5 shrink-0" />
        <p>
          This will send a notification to ALL users. Use carefully — there is
          no recall.
        </p>
      </div>

      <BroadcastForm />
    </div>
  );
}
