"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface RankingChartProps {
  data: { title: string; pct: number }[];
}

function barColor(pct: number): string {
  if (pct >= 80) return "#2dd4bf";
  if (pct >= 50) return "#38bdf8";
  if (pct >= 25) return "#facc15";
  return "#ec4899";
}

/** Barras horizontales de % de cumplimiento por hábito. */
export function RankingChart({ data }: RankingChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos en este periodo.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="title"
          width={140}
          tick={{ fill: "#8a97b1", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          contentStyle={{
            background: "#161d2e",
            border: "1px solid #2a3550",
            borderRadius: 8,
            color: "#e8edf6",
          }}
          formatter={(v) => [`${v}%`, "Cumplimiento"]}
        />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={barColor(d.pct)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
