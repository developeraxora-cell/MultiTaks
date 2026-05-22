import { SetupNotice } from "@/components/SetupNotice";
import { HabitGrid, type GridGroup } from "@/components/habit-grid/HabitGrid";
import { AnnualSummary, type AnnualRow } from "@/components/habit-grid/AnnualSummary";
import { ViewSwitcher, type ViewMode } from "@/components/habit-grid/ViewSwitcher";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { listActiveTasks, getLogsInRange, buildLogMap } from "@/lib/queries/tasks";
import {
  addDays,
  dateKey,
  formatRangeLabel,
  monthCells,
  monthName,
  monthRange,
  parseKey,
  todayKey,
  weekCells,
  weekColor,
  weekBlockIndex,
  weekRange,
  yearRange,
  type DayCell,
} from "@/lib/date";

export const dynamic = "force-dynamic";

const MS_DAY = 86_400_000;

/** Días del periodo [start,end] hasta hoy. Hábito permanente: no depende de created_at. */
function eligibleDays(start: string, end: string, today: string): number {
  const cap = end < today ? end : today;
  const diff = Math.floor((parseKey(cap).getTime() - parseKey(start).getTime()) / MS_DAY) + 1;
  return diff > 0 ? diff : 0;
}

interface SearchParams {
  view?: string;
  date?: string;
}

export default async function TrackerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const sp = await searchParams;
  const view = (["daily", "weekly", "monthly", "annual"].includes(sp.view ?? "")
    ? sp.view
    : "monthly") as ViewMode;
  const anchor = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayKey();

  const anchorDate = parseKey(anchor);
  const year = anchorDate.getFullYear();
  const monthIndex = anchorDate.getMonth();
  const day = anchorDate.getDate();
  const today = todayKey();

  const tasks = await listActiveTasks();

  // ----- Vista anual: resumen tareas × meses -----
  if (view === "annual") {
    const range = yearRange(year);
    const logs = await getLogsInRange(range.start, range.end, tasks.map((t) => t.id));

    // completados[taskId][month] (sólo logs hasta hoy).
    const completed: Record<string, number[]> = {};
    for (const t of tasks) completed[t.id] = Array(12).fill(0);
    for (const l of logs) {
      if (l.is_completed && l.date <= today) {
        const m = parseKey(l.date).getMonth();
        if (completed[l.task_id]) completed[l.task_id][m] += 1;
      }
    }

    // Días vigentes por mes (iguales para todas las tareas: hábito permanente).
    const monthElig = Array.from({ length: 12 }, (_, m) => {
      const mr = monthRange(year, m);
      return eligibleDays(mr.start, mr.end, today);
    });

    const rows: AnnualRow[] = tasks.map((t) => {
      const monthly = monthElig.map((elig, m) =>
        elig > 0 ? Math.round((1000 * completed[t.id][m]) / elig) / 10 : 0,
      );
      const totalDone = completed[t.id].reduce((a, b) => a + b, 0);
      const totalElig = monthElig.reduce((a, b) => a + b, 0);
      return {
        taskId: t.id,
        title: t.title,
        monthly,
        yearPct: totalElig > 0 ? Math.round((1000 * totalDone) / totalElig) / 10 : 0,
      };
    });

    const overallByMonth = monthElig.map((elig, m) => {
      if (elig <= 0) return 0;
      let done = 0;
      for (const t of tasks) done += completed[t.id][m];
      return Math.round((1000 * done) / (elig * tasks.length)) / 10;
    });

    return (
      <div>
        <ViewSwitcher
          view={view}
          date={anchor}
          periodLabel={String(year)}
          prevDate={dateKey(year - 1, monthIndex, 1)}
          nextDate={dateKey(year + 1, monthIndex, 1)}
        />
        <AnnualSummary rows={rows} overallByMonth={overallByMonth} />
      </div>
    );
  }

  // ----- Vistas diaria / semanal / mensual: grid de checkboxes -----
  let groups: GridGroup[] = [];
  let rangeStart = anchor;
  let rangeEnd = anchor;
  let periodLabel = "";
  let prevDate = anchor;
  let nextDate = anchor;

  if (view === "daily") {
    const block = weekBlockIndex(day);
    const cell: DayCell = {
      key: anchor,
      day,
      weekday: weekCells(anchor).find((c) => c.key === anchor)?.weekday ?? "",
      block,
      color: weekColor(block),
    };
    groups = [{ label: "DÍA", color: cell.color, cells: [cell] }];
    rangeStart = rangeEnd = anchor;
    periodLabel = `${day} ${monthName(monthIndex)} ${year}`;
    prevDate = addDays(anchor, -1);
    nextDate = addDays(anchor, 1);
  } else if (view === "weekly") {
    const cells = weekCells(anchor);
    const wr = weekRange(anchor);
    groups = [{ label: "SEMANA", color: cells[0].color, cells }];
    rangeStart = wr.start;
    rangeEnd = wr.end;
    periodLabel = formatRangeLabel(wr);
    prevDate = addDays(anchor, -7);
    nextDate = addDays(anchor, 7);
  } else {
    // monthly
    const cells = monthCells(year, monthIndex);
    const byBlock = new Map<number, DayCell[]>();
    for (const c of cells) {
      if (!byBlock.has(c.block)) byBlock.set(c.block, []);
      byBlock.get(c.block)!.push(c);
    }
    groups = [...byBlock.entries()].map(([block, cs]) => ({
      label: `SEMANA ${block + 1}`,
      color: weekColor(block),
      cells: cs,
    }));
    const mr = monthRange(year, monthIndex);
    rangeStart = mr.start;
    rangeEnd = mr.end;
    periodLabel = `${monthName(monthIndex)} ${year}`;
    prevDate = dateKey(year, monthIndex - 1, 1);
    nextDate = dateKey(year, monthIndex + 1, 1);
  }

  const logs = await getLogsInRange(rangeStart, rangeEnd, tasks.map((t) => t.id));
  const logMap = buildLogMap(logs);

  return (
    <div>
      <ViewSwitcher
        view={view}
        date={anchor}
        periodLabel={periodLabel}
        prevDate={prevDate}
        nextDate={nextDate}
      />
      <HabitGrid
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          goal: t.goal,
          start_time: t.start_time,
          end_time: t.end_time,
        }))}
        groups={groups}
        logMap={logMap}
      />
    </div>
  );
}
