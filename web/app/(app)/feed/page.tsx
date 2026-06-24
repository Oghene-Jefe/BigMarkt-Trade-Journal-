import { PageHeader, EmptyState, LinkButton, Section } from "@/components/ui";
import { getFollowingFeedAction } from "@/lib/actions/feed";
import FeedCard from "@/components/FeedCard";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const rows = await getFollowingFeedAction();

  return (
    <div className="space-y-4">
      <PageHeader title="Feed" description="Verified trades from traders you follow." />

      <div className="flex gap-6 border-b border-white/10 text-sm">
        <span className="-mb-px border-b-2 border-gold px-1 py-2 font-medium text-gold">
          Following
        </span>
        <span
          className="-mb-px cursor-not-allowed border-b-2 border-transparent px-1 py-2 text-muted"
          title="Coming soon"
        >
          All Verified
        </span>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No trades yet"
          description="Follow traders to see their verified trades here."
          action={
            <LinkButton href="/leaderboard" variant="secondary">
              Browse leaderboard
            </LinkButton>
          }
        />
      ) : (
        <Section>
          <ul className="divide-y divide-white/10">
            {rows.map((r) => (
              <li key={r.trade_id} className="first:pt-0 last:pb-0">
                <FeedCard trade={r} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
