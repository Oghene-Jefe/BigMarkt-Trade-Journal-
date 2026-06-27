export default function Post() {
  return (
    <>
      <p>
        Most traders know roughly what their win rate is. Ask them directly and they will give
        you a number — confident, usually optimistic. Ask them to pull up the actual data and
        the conversation gets quieter. The number in their head and the number in their broker
        history are rarely the same. That gap is the problem a real trading journal exists to close.
      </p>

      <h2>Why most traders do not journal</h2>
      <p>
        It is not laziness. Most traders who skip journaling do so because an honest record is
        uncomfortable. When you log every trade — including the 3am FOMO entry that blew your
        daily target, the revenge trade you placed thirty seconds after a loss, the position you
        held past your stop because you were certain it would reverse — you have to look at it.
        A spreadsheet you fill in yourself lets you curate what you see. Automated capture does not.
      </p>
      <p>
        The second reason is friction. Logging a trade manually takes effort. That effort scales
        with trade volume, and it compounds with emotional exhaustion after a bad session. Most
        traders start journaling with good intentions and stop within two weeks. Not because they
        gave up on improvement — because the tool asked too much of them.
      </p>

      <h2>The problem with self-reported data</h2>
      <p>
        Even disciplined traders who log consistently face a subtler problem: human memory is
        selective by design. You remember your cleanest setups most vividly. You log those in
        detail — entry rationale, execution quality, what you felt. The losers get shorter
        entries, vaguer reasoning, and sometimes no entry at all if the session ended badly and
        you just wanted to close the platform.
      </p>
      <p>
        Over months, a self-reported journal drifts. Your logged win rate floats upward. Your
        average RR looks better than it is. The patterns you think you see in your data are
        partly real and partly a reflection of what you chose to record. You cannot build a
        strategy improvement process on top of that.
      </p>

      <h2>What automated capture actually changes</h2>
      <p>
        When a trade is logged at the moment of execution — directly from your broker, not from
        your memory — none of that selective recording is possible. The trade exists in your
        journal because it happened, full stop. Entry price, exit price, stop loss, take profit,
        lot size, direction, net P&amp;L, timestamp. All of it, every time, including the trades
        you would rather not think about.
      </p>
      <p>
        That completeness is what makes the data useful. Patterns in incomplete data are
        misleading. Patterns in complete data are actionable. You can actually trust what you
        see — which sessions you perform in, which setups have real edge, how your risk
        management holds up under pressure versus after a winning streak.
      </p>

      <h2>How BigMarkt works with MT4 and MT5</h2>
      <p>
        BigMarkt connects to your MetaTrader account through a read-only Expert Advisor. The EA
        is installed once — a five-minute process — and from that point it runs silently in the
        background. Every trade execution on your account is streamed to your BigMarkt journal
        automatically: entry, exit, stop loss, take profit, lot size, direction, and P&amp;L,
        timestamped at the broker level.
      </p>
      <p>
        You do not type anything. You do not remember to log. You trade, and the record builds
        itself. Whether you are running five trades a week or fifty, the journal keeps up without
        any additional effort from you.
      </p>

      <h2>Verified vs manual: what the badge means</h2>
      <p>
        BigMarkt distinguishes between trades that came directly from a broker connection and
        trades that were entered by hand. Broker-captured trades receive an{" "}
        <strong>auto-verified</strong> badge. Manual entries can still live in your journal — for
        notes, reflections, or trades from accounts you have not connected — but they do not
        affect your verified stats or your leaderboard ranking.
      </p>
      <p>
        This matters because your public profile on BigMarkt is built from verified data only.
        If you share your profile link with a prop firm, a potential follower, or anyone else
        who wants to see your track record, they are looking at broker-reported numbers — not
        something you typed in.
      </p>

      <h2>Who this is for</h2>
      <p>
        If you are a serious retail trader who wants to understand what you actually do rather
        than what you think you do, BigMarkt gives you the data to work with.
      </p>
      <p>
        If you are building toward a prop firm application, a verified journal is the difference
        between saying you are consistent and being able to show it.
      </p>
      <p>
        If you trade with an SMC or ICT framework and want to track which setups — order blocks,
        fair value gaps, liquidity sweeps — actually have edge in your hands across real broker
        data, BigMarkt captures everything you need to find out.
      </p>
      <p>
        BigMarkt is free to start. No credit card required. It works with any MT4 or MT5 broker.
      </p>
    </>
  );
}
