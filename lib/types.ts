export type Role = "admin" | "user";

export const HABIT_CATEGORIES = [
  { value: "amigos", label: "Amigos" },
  { value: "salud", label: "Salud" },
  { value: "dinero", label: "Dinero" },
  { value: "amor", label: "Amor" },
  { value: "familia", label: "Familia" },
  { value: "profesion", label: "Profesión" },
  { value: "desarrollo_personal", label: "Desarrollo personal" },
  { value: "ocio", label: "Ocio" },
] as const;

export type HabitCategory = (typeof HABIT_CATEGORIES)[number]["value"];

export const DEFAULT_HABIT_CATEGORY: HabitCategory = "desarrollo_personal";

export function isHabitCategory(value: string): value is HabitCategory {
  return HABIT_CATEGORIES.some((category) => category.value === value);
}

export function habitCategoryLabel(value: string | null | undefined): string {
  return HABIT_CATEGORIES.find((category) => category.value === value)?.label ?? "Desarrollo personal";
}

export function normalizeHabitCategory(value: string | null | undefined): HabitCategory {
  return value && isHabitCategory(value) ? value : DEFAULT_HABIT_CATEGORY;
}

export interface Usuario {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  time_zone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  assigned_by: string | null;
  title: string;
  category: HabitCategory | null;
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
