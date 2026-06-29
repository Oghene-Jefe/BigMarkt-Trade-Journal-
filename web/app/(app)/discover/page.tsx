import type { Metadata } from "next";
import { supabaseServer } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import DiscoverSearch from "@/components/DiscoverSearch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover Traders",
  description: "Find and follow traders on BigMarkt by name or username.",
  alternates: { canonical: "/discover" },
};

export default async function DiscoverPage() {
  const sb = await supabaseServer();
  const {
    data: { user },
  } = await sb.auth.getUser();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Discover"
        description="Find traders by name or username and follow them."
      />
      <DiscoverSearch currentUserId={user?.id ?? null} />
    </div>
  );
}
