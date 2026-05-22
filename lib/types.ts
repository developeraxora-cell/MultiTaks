export interface Task {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  is_active: boolean;
  deleted_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface TaskLog {
  id: string;
  task_id: string;
  date: string; // YYYY-MM-DD
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

/** Mapa de cumplimiento: clave `${task_id}:${date}` → is_completed. */
export type LogMap = Record<string, boolean>;

export function logKey(taskId: string, date: string): string {
  return `${taskId}:${date}`;
}
