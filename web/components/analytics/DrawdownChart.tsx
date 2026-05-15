"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeRow } from "@/lib/types";
import { buildDrawdownSeries } from "@/lib/analytics";

export default function DrawdownChart({ trades }: { trades: TradeRow[] }) {
  const data = buildDrawdownSeries(trades);
  const minDrawdown = data.reduce((m, p) => Math.min(m, p.drawdown), 0);

  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
        DRAWDOWN
      </h3>
      {data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted">
          Not enough data yet.
        </div>
      ) : (
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <AreaChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
            >
              <defs>
                <linearGradient id="ddFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0.15} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                dataKey="tradeNumber"
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
              />
              <YAxis
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                domain={[Math.floor(minDrawdown), 0]}
                tickFormatter={(v: number) => `${v.toFixed(0)}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#141414",
                  border: "1px solid #262626",
                  borderRadius: 8,
                  color: "#f5f5f5",
                  fontSize: 12,
                }}
                labelFormatter={(label) => `Trade #${label}`}
                formatter={(value, _name, item) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const d = new Date(item?.payload?.date as string);
                  return [
                    `${v.toFixed(2)}%`,
                    `Drawdown (${d.toLocaleDateString()})`,
                  ];
                }}
              />
              <Area
                type="monotone"
                dataKey="drawdown"
                stroke="#ef4444"
                strokeWidth={1.5}
                fill="url(#ddFill)"
                fillOpacity={0.3}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
