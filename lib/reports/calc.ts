import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date";

export interface PeriodReport {
  completed: number;
  eligible: number;
  pct: number;
}

export interface OverallReport {
  completed: number;
  possible: number;
  pct: number;
}

export interface TaskRankingRow {
  task_id: string;
  title: string;
  completed: number;
  eligible: number;
  pct: number;
}

export interface DayProductivity {
  d: string;
  completed: number;
  total: number;
  pct: number;
}

export interface Streaks {
  current: number;
  best: number;
}

export async function reportTaskPeriod(
  taskId: string,
  range: DateRange,
): Promise<PeriodReport> {
  const { data, error } = await getSupabase().rpc("report_task_period", {
    p_task_id: taskId,
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return {
    completed: Number(row?.completed ?? 0),
    eligible: Number(row?.eligible ?? 0),
    pct: Number(row?.pct ?? 0),
  };
}

export async function reportOverall(range: DateRange): Promise<OverallReport> {
  const { data, error } = await getSupabase().rpc("report_overall", {
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return {
    completed: Number(row?.completed ?? 0),
    possible: Number(row?.possible ?? 0),
    pct: Number(row?.pct ?? 0),
  };
}

export async function reportTaskRanking(range: DateRange): Promise<TaskRankingRow[]> {
  const { data, error } = await getSupabase().rpc("report_task_ranking", {
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    task_id: String(r.task_id),
    title: String(r.title),
    completed: Number(r.completed),
    eligible: Number(r.eligible),
    pct: Number(r.pct),
  }));
}

export async function reportDayProductivity(range: DateRange): Promise<DayProductivity[]> {
  const { data, error } = await getSupabase().rpc("report_day_productivity", {
    p_start: range.start,
    p_end: range.end,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => ({
    d: String(r.d),
    completed: Number(r.completed),
    total: Number(r.total),
    pct: Number(r.pct),
  }));
}

/**
 * Racha de días con 100% de cumplimiento (todas las tareas activas marcadas).
 * `days` debe venir ordenado ascendente por fecha. La racha actual cuenta desde
 * el final hacia atrás.
 */
export function computeStreaks(days: DayProductivity[]): Streaks {
  let best = 0;
  let run = 0;
  for (const day of days) {
    const full = day.total > 0 && day.completed >= day.total;
    run = full ? run + 1 : 0;
    if (run > best) best = run;
  }

  let current = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i];
    if (day.total > 0 && day.completed >= day.total) current++;
    else break;
  }

  return { current, best };
}

/** Mejor y peor día por % (ignora días sin tareas vigentes). */
export function bestAndWorstDay(days: DayProductivity[]): {
  best: DayProductivity | null;
  worst: DayProductivity | null;
} {
  const valid = days.filter((d) => d.total > 0);
  if (valid.length === 0) return { best: null, worst: null };
  let best = valid[0];
  let worst = valid[0];
  for (const d of valid) {
    if (d.pct > best.pct) best = d;
    if (d.pct < worst.pct) worst = d;
  }
  return { best, worst };
}
