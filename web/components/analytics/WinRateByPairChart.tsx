"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeRow } from "@/lib/types";
import { buildWinRateByPair } from "@/lib/analytics";

export default function WinRateByPairChart({ trades }: { trades: TradeRow[] }) {
  const data = buildWinRateByPair(trades);
  const height = Math.max(200, Math.min(400, data.length * 40 + 60));

  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
        WIN RATE BY PAIR
      </h3>
      {data.length < 3 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted">
          Not enough data yet. Keep logging trades.
        </div>
      ) : (
        <div style={{ width: "100%", height }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
            >
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                type="number"
                domain={[0, 100]}
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                tickFormatter={(v: number) => `${v}%`}
              />
              <YAxis
                dataKey="pair"
                type="category"
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                width={70}
              />
              <Tooltip
                cursor={{ fill: "rgba(212,175,55,0.08)" }}
                contentStyle={{
                  backgroundColor: "#141414",
                  border: "1px solid #262626",
                  borderRadius: 8,
                  color: "#f5f5f5",
                  fontSize: 12,
                }}
                formatter={(value, _name, item) => {
                  const v = typeof value === "number" ? value : Number(value);
                  return [
                    `${v.toFixed(1)}% (${item?.payload?.total} trades)`,
                    item?.payload?.pair,
                  ];
                }}
              />
              <Bar dataKey="winRate" fill="#D4AF37" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
