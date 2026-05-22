export interface Task {
  id: string;
  title: string;
  description: string | null;
  goal: string | null;
  start_time: string | null; // HH:MM, hora de inicio (opcional)
  end_time: string | null;   // HH:MM, hora de fin del rango (opcional)
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

/** "HH:MM" desde un time de Postgres ("HH:MM:SS") o null. */
function hhmm(t: string | null): string | null {
  return t ? t.slice(0, 5) : null;
}

/** Etiqueta de horario: "08:00–09:00", "08:00" o "" si no hay horas. */
export function formatTimeRange(start: string | null, end: string | null): string {
  const s = hhmm(start);
  const e = hhmm(end);
  if (s && e) return `${s}–${e}`;
  if (s) return s;
  if (e) return `hasta ${e}`;
  return "";
}
