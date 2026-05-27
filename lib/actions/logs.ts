"use server";

import { revalidatePath } from "next/cache";

import { getSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { todayKey } from "@/lib/date";

/**
 * Marca/desmarca el cumplimiento de una tarea en una fecha concreta.
 *
 * Upsert sobre UNIQUE(task_id, date): una sola fila por (tarea, día). `user_id` =
 * dueño de la tarea. Solo el dueño (o un admin) puede marcar.
 */
export async function toggleLog(
  taskId: string,
  date: string,
  isCompleted: boolean,
): Promise<void> {
  const session = await requireUser();

  const { data: task, error: taskErr } = await getSupabase()
    .from("tasks")
    .select("id, user_id")
    .eq("id", taskId)
    .maybeSingle();
  if (taskErr) throw new Error(taskErr.message);
  if (!task) throw new Error("Tarea no encontrada");
  if (session.role !== "admin" && task.user_id !== session.userId) {
    throw new Error("No autorizado");
  }
  if (date > todayKey(session.timeZone)) {
    throw new Error("No puedes marcar hábitos de fechas futuras");
  }

  const { error } = await getSupabase()
    .from("task_logs")
    .upsert(
      { task_id: taskId, user_id: task.user_id, date, is_completed: isCompleted },
      { onConflict: "task_id,date" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/home");
  revalidatePath("/tracker");
  revalidatePath("/reports");
  revalidatePath("/admin/monitor");
}

/** Marca/desmarca usando la fecha real de la app en el momento del clic. */
export async function toggleTodayLog(taskId: string, isCompleted: boolean): Promise<void> {
  const session = await requireUser();
  await toggleLog(taskId, todayKey(session.timeZone), isCompleted);
}
