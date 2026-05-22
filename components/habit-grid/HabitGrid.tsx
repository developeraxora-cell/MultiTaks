import Link from "next/link";
import type { DayCell } from "@/lib/date";
import { logKey, type LogMap } from "@/lib/types";
import { HabitCell } from "./HabitCell";

export interface GridGroup {
  label: string; // ej. "SEMANA 1"
  color: string;
  cells: DayCell[];
}

interface HabitGridProps {
  tasks: { id: string; title: string; goal: string | null }[];
  groups: GridGroup[];
  logMap: LogMap;
}

/**
 * Tabla de hábitos: filas = hábitos, columnas = días agrupados por semana.
 * Columna de hábito sticky a la izquierda; scroll horizontal en el resto.
 */
export function HabitGrid({ tasks, groups, logMap }: HabitGridProps) {
  if (tasks.length === 0) {
    return (
      <p className="px-4 py-12 text-center text-sm text-muted">
        No hay hábitos activos.{" "}
        <Link href="/tasks" className="text-accent underline">
          Crea el primero
        </Link>
        .
      </p>
    );
  }

  return (
    <div
      className="scroll-thin overflow-x-auto"
      style={{
        scrollSnapType: "x proximity",
        scrollPaddingLeft: "13rem",
        overscrollBehaviorX: "contain",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <table className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-20 min-w-36 sm:min-w-52 border-b border-border bg-surface px-3 py-2 text-right align-bottom font-semibold"
            >
              HÁBITOS DIARIOS
            </th>
            <th
              rowSpan={2}
              className="border-b border-border bg-surface px-3 py-2 text-left align-bottom font-semibold text-muted"
            >
              METAS
            </th>
            {groups.map((g, i) => (
              <th
                key={`${g.label}-${i}`}
                colSpan={g.cells.length}
                className="border-b border-l border-border px-2 py-2 text-center text-xs font-bold uppercase tracking-wide"
                style={{ color: g.color, scrollSnapAlign: "start" }}
              >
                {g.label}
              </th>
            ))}
          </tr>
          <tr>
            {groups.flatMap((g) =>
              g.cells.map((c, idx) => (
                <th
                  key={c.key}
                  className={`border-b border-border px-1 py-1 text-center font-normal text-muted ${
                    idx === 0 ? "border-l" : ""
                  }`}
                  style={idx === 0 ? { borderLeftColor: g.color } : undefined}
                >
                  <div className="text-[10px] leading-tight">{c.weekday}</div>
                  <div className="text-xs leading-tight text-foreground">{c.day}</div>
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="group">
              <td className="sticky left-0 z-10 max-w-36 truncate sm:max-w-52 border-b border-border bg-surface px-3 py-1.5 text-right text-foreground">
                <Link href={`/reports/${task.id}`} className="hover:text-accent" title={task.title}>
                  {task.title}
                </Link>
              </td>
              <td className="border-b border-border px-3 py-1.5 text-xs text-muted">
                {task.goal ?? ""}
              </td>
              {groups.flatMap((g) =>
                g.cells.map((c, idx) => (
                  <td
                    key={c.key}
                    className={`border-b border-border px-1 py-1 text-center ${
                      idx === 0 ? "border-l" : ""
                    }`}
                    style={idx === 0 ? { borderLeftColor: g.color } : undefined}
                  >
                    <div className="flex justify-center">
                      <HabitCell
                        taskId={task.id}
                        date={c.key}
                        color={c.color}
                        completed={Boolean(logMap[logKey(task.id, c.key)])}
                      />
                    </div>
                  </td>
                )),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
