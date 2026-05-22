import Link from "next/link";
import { monthName } from "@/lib/date";

export interface AnnualRow {
  taskId: string;
  title: string;
  monthly: number[]; // 12 porcentajes
  yearPct: number;
}

interface AnnualSummaryProps {
  rows: AnnualRow[];
  overallByMonth: number[];
}

function cellColor(pct: number): string {
  if (pct >= 80) return "rgba(45,212,191,0.85)";
  if (pct >= 50) return "rgba(56,189,248,0.7)";
  if (pct >= 25) return "rgba(250,204,21,0.6)";
  if (pct > 0) return "rgba(236,72,153,0.55)";
  return "transparent";
}

/** Resumen anual: filas = hábitos, columnas = 12 meses, celda = % cumplimiento. */
export function AnnualSummary({ rows, overallByMonth }: AnnualSummaryProps) {
  if (rows.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted">
        No hay hábitos activos para resumir.
      </p>
    );
  }
  return (
    <div className="scroll-thin overflow-x-auto px-4">
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-36 sm:min-w-52 border-b border-border bg-surface px-3 py-2 text-right font-semibold">
              HÁBITO
            </th>
            {Array.from({ length: 12 }, (_, m) => (
              <th
                key={m}
                className="border-b border-border px-2 py-2 text-center text-xs font-medium capitalize text-muted"
              >
                {monthName(m).slice(0, 3)}
              </th>
            ))}
            <th className="border-b border-border px-3 py-2 text-center text-xs font-semibold">
              Año
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.taskId}>
              <td className="sticky left-0 z-10 max-w-36 truncate sm:max-w-52 border-b border-border bg-surface px-3 py-1.5 text-right">
                <Link href={`/reports/${row.taskId}`} className="hover:text-accent">
                  {row.title}
                </Link>
              </td>
              {row.monthly.map((pct, m) => (
                <td
                  key={m}
                  className="border-b border-border px-1 py-1 text-center text-xs"
                  style={{ backgroundColor: cellColor(pct) }}
                  title={`${monthName(m)}: ${pct}%`}
                >
                  {pct > 0 ? `${Math.round(pct)}` : "·"}
                </td>
              ))}
              <td className="border-b border-border px-3 py-1.5 text-center text-xs font-semibold">
                {Math.round(row.yearPct)}%
              </td>
            </tr>
          ))}
          <tr>
            <td className="sticky left-0 z-10 border-t-2 border-border bg-surface px-3 py-2 text-right text-xs font-semibold text-accent">
              GENERAL
            </td>
            {overallByMonth.map((pct, m) => (
              <td
                key={m}
                className="border-t-2 border-border px-1 py-2 text-center text-xs font-medium"
                style={{ color: pct >= 50 ? "#2dd4bf" : "#8a97b1" }}
              >
                {pct > 0 ? Math.round(pct) : "·"}
              </td>
            ))}
            <td className="border-t-2 border-border px-3 py-2" />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
