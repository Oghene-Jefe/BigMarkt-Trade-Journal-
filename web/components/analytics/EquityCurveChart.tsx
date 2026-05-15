"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeRow } from "@/lib/types";
import { buildEquityCurve } from "@/lib/analytics";

export default function EquityCurveChart({ trades }: { trades: TradeRow[] }) {
  const data = buildEquityCurve(trades);
  const lastEquity = data.length > 0 ? data[data.length - 1]!.equity : 0;
  const lineColor = lastEquity >= 0 ? "#D4AF37" : "#ef4444";

  return (
    <div className="rounded-lg border border-white/10 bg-panel p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
        EQUITY CURVE
      </h3>
      {data.length === 0 ? (
        <EmptyState />
      ) : (
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer>
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
            >
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                dataKey="tradeNumber"
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
              />
              <YAxis
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                tickFormatter={(v: number) => `$${v.toFixed(0)}`}
              />
              <ReferenceLine y={0} stroke="#525252" strokeDasharray="2 2" />
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
                    `$${v.toFixed(2)}`,
                    `Equity (${d.toLocaleDateString()})`,
                  ];
                }}
              />
              <Line
                type="monotone"
                dataKey="equity"
                stroke={lineColor}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[280px] items-center justify-center text-sm text-muted">
      Not enough data yet. Log a few trades.
    </div>
  );
}
