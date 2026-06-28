import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { getFollowingFeedAction, getFollowingOpenPositionsAction } from "@/lib/actions/feed";
import TradeCard, { type CardTrade } from "@/components/TradeCard";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const [closed, open] = await Promise.all([
    getFollowingFeedAction(),
    getFollowingOpenPositionsAction(),
  ]);

  const openCards: CardTrade[] = open.map((o) => ({
    trade_id: o.trade_id,
    user_id: o.user_id,
    pair: o.pair,
    direction: o.direction,
    result: null,
    return_pct: null,
    rr_ratio: null,
    trust_badge: o.trust_badge,
    isOpen: true,
    timestamp: o.opened_at,
    leader_display_name: o.leader_display_name,
    leader_username: o.leader_username,
    leader_avatar_url: o.leader_avatar_url,
  }));

  const closedCards: CardTrade[] = closed.map((c) => ({
    trade_id: c.trade_id,
    user_id: c.user_id,
    pair: c.pair,
    direction: c.direction,
    result: c.result,
    return_pct: c.return_pct,
    rr_ratio: c.rr_ratio,
    trust_badge: c.trust_badge,
    isOpen: false,
    timestamp: c.created_at,
    leader_display_name: c.leader_display_name,
    leader_username: c.leader_username,
    leader_avatar_url: c.leader_avatar_url,
  }));

  const hasAny = openCards.length + closedCards.length > 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Feed" description="Live and verified trades from traders you follow." />

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

      {!hasAny ? (
        <EmptyState
          title="No trades yet"
          description="Follow traders to see their live and verified trades here."
          action={
            <LinkButton href="/leaderboard" variant="secondary">
              Browse leaderboard
            </LinkButton>
          }
        />
      ) : (
        <div className="space-y-5">
          {openCards.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Live now
              </h2>
              <div className="space-y-3">
                {openCards.map((c) => (
                  <TradeCard key={`open-${c.trade_id}`} trade={c} />
                ))}
              </div>
            </section>
          ) : null}

          {closedCards.length > 0 ? (
            <section className="space-y-3">
              {openCards.length > 0 ? (
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Recent
                </h2>
              ) : null}
              <div className="space-y-3">
                {closedCards.map((c) => (
                  <TradeCard key={`closed-${c.trade_id}`} trade={c} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
