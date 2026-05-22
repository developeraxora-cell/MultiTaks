import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { logKey, type LogMap, type Task, type TaskLog } from "@/lib/types";

/** Tareas no eliminadas (para gestión). Opcionalmente solo activas. */
export async function listTasks(onlyActive = false): Promise<Task[]> {
  let query = getSupabase()
    .from("tasks")
    .select("*")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (onlyActive) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}

/** Tareas activas y vigentes — las que aparecen en el grid de seguimiento. */
export function listActiveTasks(): Promise<Task[]> {
  return listTasks(true);
}

export async function getTask(id: string): Promise<Task | null> {
  const { data, error } = await getSupabase()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Task) ?? null;
}

/** Logs en un rango de fechas (opcionalmente acotado a unas tareas). */
export async function getLogsInRange(
  start: string,
  end: string,
  taskIds?: string[],
): Promise<TaskLog[]> {
  let query = getSupabase()
    .from("task_logs")
    .select("*")
    .gte("date", start)
    .lte("date", end);

  if (taskIds && taskIds.length > 0) query = query.in("task_id", taskIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskLog[];
}

/** Construye un mapa `${task_id}:${date}` → is_completed desde una lista de logs. */
export function buildLogMap(logs: TaskLog[]): LogMap {
  const map: LogMap = {};
  for (const log of logs) map[logKey(log.task_id, log.date)] = log.is_completed;
  return map;
}
