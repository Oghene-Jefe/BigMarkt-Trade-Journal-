"use client";

import { useRef } from "react";
import TradeCard, { type TradeCardProps } from "./TradeCard";
import ShareTradeButton from "./ShareTradeButton";

type Props = TradeCardProps;

export default function ShareableTradeCard(props: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-4">
      <TradeCard {...props} ref={cardRef} />
      <ShareTradeButton cardRef={cardRef} pair={props.pair} result={props.result} />
    </div>
  );
}
