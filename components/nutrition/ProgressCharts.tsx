"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const tooltipStyle = {
  background: "#161d2e",
  border: "1px solid #2a3550",
  borderRadius: 8,
  color: "#e8edf6",
};

/** Evolución diaria de calorías con línea de meta. */
export function CaloriesTrend({
  data,
  goal,
}: {
  data: { date: string; calories: number }[];
  goal: number;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos todavía.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="calFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#8a97b1", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={20}
        />
        <YAxis tick={{ fill: "#8a97b1", fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} kcal`, "Calorías"]} />
        {goal > 0 && (
          <ReferenceLine y={goal} stroke="#fbbf24" strokeDasharray="4 4" label={{ value: "Meta", fill: "#fbbf24", fontSize: 10, position: "insideTopRight" }} />
        )}
        <Area type="monotone" dataKey="calories" stroke="#34d399" strokeWidth={2} fill="url(#calFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Comparación diaria de calorías contra la meta. */
export function DailyCaloriesBars({
  data,
  goal,
}: {
  data: { date: string; calories: number }[];
  goal: number;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos todavía.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#8a97b1", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={18}
        />
        <YAxis tick={{ fill: "#8a97b1", fontSize: 10 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} kcal`, "Calorías"]} />
        {goal > 0 && <ReferenceLine y={goal} stroke="#fbbf24" strokeDasharray="4 4" />}
        <Bar dataKey="calories" name="Calorías" fill="#34d399" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Macros diarios como barras apiladas. */
export function DailyMacrosStack({
  data,
}: {
  data: { date: string; protein: number; carbs: number; fat: number }[];
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos todavía.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#8a97b1", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={18}
        />
        <YAxis tick={{ fill: "#8a97b1", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="protein" name="Proteína" stackId="macro" fill="#38BDF8" radius={[0, 0, 0, 0]} />
        <Bar dataKey="carbs" name="Carbos" stackId="macro" fill="#FACC15" radius={[0, 0, 0, 0]} />
        <Bar dataKey="fat" name="Grasa" stackId="macro" fill="#F472B6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Evolución de calidad nutricional. */
export function QualityTrend({
  data,
}: {
  data: { date: string; quality: number | null }[];
}) {
  const filtered = data.filter((d) => d.quality != null);
  if (filtered.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos todavía.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={filtered} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: "#8a97b1", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(d: string) => d.slice(5)}
          minTickGap={18}
        />
        <YAxis domain={[0, 100]} tick={{ fill: "#8a97b1", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v}/100`, "Calidad"]} />
        <Line type="monotone" dataKey="quality" name="Calidad" stroke="#22d3ee" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Promedio semanal de macros (barras agrupadas por semana). */
export function WeeklyMacros({
  data,
}: {
  data: { week: string; protein: number; carbs: number; fat: number }[];
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted">Sin datos todavía.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid stroke="#2a3550" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fill: "#8a97b1", fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fill: "#8a97b1", fontSize: 10 }} tickLine={false} axisLine={false} width={36} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey="protein" name="Proteína" fill="#38BDF8" radius={[3, 3, 0, 0]} />
        <Bar dataKey="carbs" name="Carbos" fill="#FACC15" radius={[3, 3, 0, 0]} />
        <Bar dataKey="fat" name="Grasa" fill="#F472B6" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
