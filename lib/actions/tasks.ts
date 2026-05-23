"use server";

import { revalidatePath } from "next/cache";

import { getSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";

function revalidateAll() {
  revalidatePath("/tracker");
  revalidatePath("/tasks");
  revalidatePath("/reports");
  revalidatePath("/admin/monitor");
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Crea una tarea/hábito. Dueño = usuario en sesión.
 * Si el admin envía `target_user_id`, asigna la tarea a ese usuario
 * (assigned_by = admin).
 */
export async function createTask(formData: FormData): Promise<void> {
  const session = await requireUser();
  const title = str(formData.get("title"));
  if (!title) throw new Error("El título es obligatorio");

  const target = str(formData.get("target_user_id"));
  const assigning = target && session.role === "admin" && target !== session.userId;

  const { error } = await getSupabase().from("tasks").insert({
    user_id: assigning ? target : session.userId,
    assigned_by: assigning ? session.userId : null,
    title,
    start_time: str(formData.get("start_time")) || null,
    end_time: str(formData.get("end_time")) || null,
  });
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Edita una tarea. El usuario solo puede editar las suyas; el admin, cualquiera. */
export async function updateTask(formData: FormData): Promise<void> {
  const session = await requireUser();
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  if (!id) throw new Error("Falta el id de la tarea");
  if (!title) throw new Error("El título es obligatorio");

  let query = getSupabase()
    .from("tasks")
    .update({
      title,
      start_time: str(formData.get("start_time")) || null,
      end_time: str(formData.get("end_time")) || null,
    })
    .eq("id", id);
  if (session.role !== "admin") query = query.eq("user_id", session.userId);

  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidateAll();
}

/**
 * Eliminación DEFINITIVA: borra la tarea y, por FK on delete cascade, todos sus
 * logs. Los reportes dejan de contarla. No se puede deshacer.
 */
export async function deleteTask(id: string): Promise<void> {
  const session = await requireUser();
  const sb = getSupabase();

  // Borra logs primero (funciona aunque el FK no sea on delete cascade).
  let logsQ = sb.from("task_logs").delete().eq("task_id", id);
  if (session.role !== "admin") logsQ = logsQ.eq("user_id", session.userId);
  const { error: logsErr } = await logsQ;
  if (logsErr) throw new Error(logsErr.message);

  let taskQ = sb.from("tasks").delete().eq("id", id);
  if (session.role !== "admin") taskQ = taskQ.eq("user_id", session.userId);
  const { error } = await taskQ;
  if (error) throw new Error(error.message);
  revalidateAll();
}
