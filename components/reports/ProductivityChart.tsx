"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ProductivityChartProps {
  data: { d: string; pct: number }[];
}

/** Área de % de cumplimiento general por día. */
export function ProductivityChart({ data }: ProductivityChartProps) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos en este periodo.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="prodFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="d"
          tick={{ fill: "#8a97b1", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => d.slice(8)}
          minTickGap={16}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fill: "#8a97b1", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Tooltip
          contentStyle={{
            background: "#161d2e",
            border: "1px solid #2a3550",
            borderRadius: 8,
            color: "#e8edf6",
          }}
          formatter={(v) => [`${v}%`, "Cumplimiento"]}
        />
        <Area
          type="monotone"
          dataKey="pct"
          stroke="#2dd4bf"
          strokeWidth={2}
          fill="url(#prodFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
