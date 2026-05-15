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

      <div
        className="rounded-lg border p-4 text-sm"
        style={{
          borderColor: "rgba(239,68,68,0.4)",
          backgroundColor: "rgba(239,68,68,0.08)",
          color: "#fca5a5",
        }}
      >
        ⚠ This will send a notification to ALL users. Use carefully — there is
        no recall.
      </div>

      <BroadcastForm />
    </div>
  );
}
