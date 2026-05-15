"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeRow } from "@/lib/types";
import { buildSessionPerformance } from "@/lib/analytics";

export default function SessionChart({ trades }: { trades: TradeRow[] }) {
  const data = buildSessionPerformance(trades);

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-4">
      <h3 className="mb-3 font-display text-sm tracking-widest text-gold">
        SESSION PERFORMANCE
      </h3>
      {data.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted">
          No session data yet.
        </div>
      ) : (
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <BarChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 8, left: 8 }}
            >
              <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
              <XAxis
                dataKey="session"
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
              />
              <YAxis
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
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
                formatter={(value, name) => {
                  const v = typeof value === "number" ? value : Number(value);
                  const n = String(name);
                  if (n === "Win Rate") return [`${v.toFixed(1)}%`, n];
                  if (n === "Avg PnL") return [`$${v.toFixed(2)}`, n];
                  return [String(value), n];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#a3a3a3" }}
              />
              <Bar dataKey="winRate" name="Win Rate" fill="#D4AF37" isAnimationActive={false} />
              <Bar dataKey="avgPnl" name="Avg PnL" isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell
                    key={i}
                    fill={d.avgPnl >= 0 ? "#22c55e" : "#ef4444"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
