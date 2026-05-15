"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TradeRow } from "@/lib/types";
import { buildSetupGradePerformance } from "@/lib/analytics";

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#D4AF37",
  C: "#ef4444",
  Ungraded: "#6b7280",
};

export default function SetupGradeChart({ trades }: { trades: TradeRow[] }) {
  const data = buildSetupGradePerformance(trades);

  return (
    <div className="rounded-2xl border border-white/10 bg-panel p-4">
      <h3 className="mb-3 font-display text-sm tracking-widest text-gold">
        SETUP GRADE PERFORMANCE
      </h3>
      {data.length === 0 ? (
        <div className="flex h-[240px] items-center justify-center text-sm text-muted">
          No graded setups yet.
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
                dataKey="grade"
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
              />
              <YAxis
                stroke="#737373"
                tick={{ fill: "#a3a3a3", fontSize: 11 }}
                domain={[0, 100]}
                tickFormatter={(v: number) => `${v}%`}
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
                formatter={(_value, _name, item) => {
                  const p = item?.payload;
                  return [
                    `${p?.winRate?.toFixed(1)}% · avg $${p?.avgPnl?.toFixed(2)} · ${p?.total} trades`,
                    `Grade ${p?.grade}`,
                  ];
                }}
              />
              <Bar dataKey="winRate" isAnimationActive={false} radius={[4, 4, 0, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={GRADE_COLORS[d.grade] ?? "#6b7280"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
