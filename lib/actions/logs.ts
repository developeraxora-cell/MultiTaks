"use server";

import { revalidatePath } from "next/cache";

import { getSupabase } from "@/lib/supabase/server";

/**
 * Marca/desmarca el cumplimiento de una tarea en una fecha concreta.
 *
 * Upsert sobre la restricción UNIQUE(task_id, date): garantiza una sola fila por
 * (tarea, día), sin duplicados. Cada fecha tiene su estado independiente.
 */
export async function toggleLog(
  taskId: string,
  date: string,
  isCompleted: boolean,
): Promise<void> {
  const { error } = await getSupabase()
    .from("task_logs")
    .upsert(
      { task_id: taskId, date, is_completed: isCompleted },
      { onConflict: "task_id,date" },
    );
  if (error) throw new Error(error.message);

  revalidatePath("/tracker");
  revalidatePath("/reports");
}
