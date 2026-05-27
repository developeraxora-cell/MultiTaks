"use client";

interface RadarPoint {
  label: string;
  pct: number;
  completed?: number;
  possible?: number;
}

interface RadarSeries {
  name: string;
  color: string;
  data: RadarPoint[];
}

interface HabitCategoryRadarProps {
  data?: RadarPoint[];
  series?: RadarSeries[];
  height?: number;
  color?: string;
}

const LEVELS = [25, 50, 75, 100];
const SIZE = 380;
const CENTER = SIZE / 2;
const RADIUS = 116;
const LABEL_RADIUS = 154;

export function HabitCategoryRadar({
  data,
  series,
  height = 320,
  color = "#2dd4bf",
}: HabitCategoryRadarProps) {
  const chartSeries = series?.length
    ? series
    : [{ name: "Cumplimiento", color, data: data ?? [] }];
  const labels = chartSeries[0]?.data.map((row) => row.label) ?? [];
  const hasData = chartSeries.some((entry) =>
    entry.data.some((row) => (row.possible ?? row.pct) > 0),
  );

  if (!hasData) {
    return <p className="py-10 text-center text-sm text-muted">Sin hábitos para graficar.</p>;
  }

  const angleFor = (index: number) => -Math.PI / 2 + (index * 2 * Math.PI) / labels.length;
  const pointAt = (index: number, pct: number, radius = RADIUS) => {
    const angle = angleFor(index);
    const distance = radius * Math.max(0, Math.min(100, pct)) / 100;
    return {
      x: CENTER + Math.cos(angle) * distance,
      y: CENTER + Math.sin(angle) * distance,
    };
  };
  const polygonPoints = (values: number[], radius = RADIUS) =>
    values.map((value, index) => {
      const point = pointAt(index, value, radius);
      return `${point.x},${point.y}`;
    }).join(" ");
  const visiblePolygonPoints = (values: number[]) =>
    values
      .map((value, index) => ({ value, index }))
      .filter((point) => point.value > 0)
      .map(({ value, index }) => {
        const point = pointAt(index, value);
        return `${point.x},${point.y}`;
      })
      .join(" ");
  const labelPosition = (index: number) => {
    const angle = angleFor(index);
    const anchor = Math.abs(Math.cos(angle)) < 0.25 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
    const baseline = Math.abs(Math.sin(angle)) < 0.25 ? "middle" : Math.sin(angle) > 0 ? "hanging" : "auto";
    return {
      x: CENTER + Math.cos(angle) * LABEL_RADIUS,
      y: CENTER + Math.sin(angle) * LABEL_RADIUS,
      anchor: anchor as "middle" | "start" | "end",
      baseline: baseline as "middle" | "hanging" | "auto",
    };
  };

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox="0 0 380 380" role="img" className="h-full w-full overflow-visible">
        <title>Balance por tipo de hábito</title>
        {LEVELS.map((level) => (
          <polygon
            key={level}
            points={polygonPoints(Array(labels.length).fill(level))}
            fill="none"
            stroke="#2a3550"
            strokeWidth={1}
          />
        ))}
        {labels.map((_, index) => {
          const end = pointAt(index, 100);
          return (
            <line
              key={index}
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              stroke="#2a3550"
              strokeWidth={1}
            />
          );
        })}
        {LEVELS.map((level) => {
          const point = pointAt(0, level);
          return (
            <text
              key={level}
              x={CENTER + 7}
              y={point.y + 4}
              fill="#8a97b1"
              fontSize={10}
            >
              {level}%
            </text>
          );
        })}
        {chartSeries.map((entry, seriesIndex) => {
          const values = labels.map((label) => {
            const point = entry.data.find((item) => item.label === label);
            return point?.pct ?? 0;
          });
          const points = visiblePolygonPoints(values);
          return (
            <polygon
              key={entry.name}
              points={points}
              fill={entry.color}
              fillOpacity={chartSeries.length > 1 ? 0.10 : 0.15}
              stroke={entry.color}
              strokeOpacity={0.95}
              strokeWidth={2.5}
              style={{
                filter: seriesIndex === 0 ? "drop-shadow(0 0 8px rgba(45, 212, 191, 0.18))" : undefined,
              }}
            />
          );
        })}
        {labels.map((label, index) => {
          const position = labelPosition(index);
          return (
            <text
              key={label}
              x={position.x}
              y={position.y}
              textAnchor={position.anchor}
              dominantBaseline={position.baseline}
              fill="#e8edf6"
              fontSize={11}
            >
              {label === "Desarrollo personal" ? (
                <>
                  <tspan x={position.x} dy="-0.35em">Desarrollo</tspan>
                  <tspan x={position.x} dy="1.15em">personal</tspan>
                </>
              ) : (
                label
              )}
            </text>
          );
        })}
      </svg>
      {chartSeries.length > 1 && (
        <div className="mt-2 flex flex-wrap justify-center gap-3 text-xs text-muted">
          {chartSeries.map((entry) => (
            <span key={entry.name} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
