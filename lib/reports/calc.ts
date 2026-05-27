import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import type { DateRange } from "@/lib/date";
import {
  DEFAULT_HABIT_CATEGORY,
  HABIT_CATEGORIES,
  normalizeHabitCategory,
  type HabitCategory,
  type Task,
  type TaskLog,
} from "@/lib/types";

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

export interface CategoryPerformance {
  category: HabitCategory;
  label: string;
  completed: number;
  possible: number;
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

export async function reportOverall(userId: string, range: DateRange): Promise<OverallReport> {
  const { data, error } = await getSupabase().rpc("report_overall", {
    p_user_id: userId,
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

export async function reportTaskRanking(userId: string, range: DateRange): Promise<TaskRankingRow[]> {
  const { data, error } = await getSupabase().rpc("report_task_ranking", {
    p_user_id: userId,
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

export async function reportDayProductivity(userId: string, range: DateRange): Promise<DayProductivity[]> {
  const { data, error } = await getSupabase().rpc("report_day_productivity", {
    p_user_id: userId,
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

const MS_DAY = 86_400_000;

function dateToMs(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function eligibleDays(start: string, end: string, today: string): number {
  const cap = end < today ? end : today;
  const days = Math.floor((dateToMs(cap) - dateToMs(start)) / MS_DAY) + 1;
  return days > 0 ? days : 0;
}

export async function reportCategoryPerformance(
  userId: string,
  range: DateRange,
  today: string,
): Promise<CategoryPerformance[]> {
  const { data: taskData, error: taskError } = await getSupabase()
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .is("deleted_at", null);
  if (taskError) throw new Error(taskError.message);

  const tasks = (taskData ?? []) as Task[];
  const stats = new Map<HabitCategory, { completed: number; possible: number }>();
  for (const category of HABIT_CATEGORIES) {
    stats.set(category.value, { completed: 0, possible: 0 });
  }

  const possiblePerTask = eligibleDays(range.start, range.end, today);
  for (const task of tasks) {
    const category = normalizeHabitCategory(task.category);
    stats.get(category)!.possible += possiblePerTask;
  }

  if (tasks.length > 0) {
    const { data: logData, error: logError } = await getSupabase()
      .from("task_logs")
      .select("*")
      .in("task_id", tasks.map((task) => task.id))
      .gte("date", range.start)
      .lte("date", range.end)
      .lte("date", today)
      .eq("is_completed", true);
    if (logError) throw new Error(logError.message);

    const categoryByTask = new Map(
      tasks.map((task) => [
        task.id,
        normalizeHabitCategory(task.category),
      ]),
    );
    for (const log of (logData ?? []) as TaskLog[]) {
      const category = categoryByTask.get(log.task_id) ?? DEFAULT_HABIT_CATEGORY;
      stats.get(category)!.completed += 1;
    }
  }

  return HABIT_CATEGORIES.map((category) => {
    const row = stats.get(category.value)!;
    return {
      category: category.value,
      label: category.label,
      completed: row.completed,
      possible: row.possible,
      pct: row.possible > 0 ? Math.round((1000 * row.completed) / row.possible) / 10 : 0,
    };
  });
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
