const TICKER_TEXT =
  "TRACKS: Money Foundations • Investing Fundamentals • Crypto & Digital Assets • Business Finance • Global Markets • Trading Track •";

export default function Ticker() {
  return (
    <div className="overflow-hidden border-y border-[#1f1f1f] bg-[#0a0a0a] py-4">
      <div className="ticker-track flex whitespace-nowrap">
        <span className="px-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#C9A84C]">
          {TICKER_TEXT}&nbsp;{TICKER_TEXT}
        </span>
        <span className="px-6 text-sm font-semibold uppercase tracking-[0.2em] text-[#C9A84C]" aria-hidden>
          {TICKER_TEXT}&nbsp;{TICKER_TEXT}
        </span>
      </div>
    </div>
  );
}
