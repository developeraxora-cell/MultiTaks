"use server";

import { revalidatePath } from "next/cache";

import { getSupabase } from "@/lib/supabase/server";

function revalidateAll() {
  revalidatePath("/tracker");
  revalidatePath("/tasks");
  revalidatePath("/reports");
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Crea una tarea/hábito. Pensada para usarse como `action` de un <form>. */
export async function createTask(formData: FormData): Promise<void> {
  const title = str(formData.get("title"));
  if (!title) throw new Error("El título es obligatorio");

  const { error } = await getSupabase().from("tasks").insert({
    title,
    description: str(formData.get("description")) || null,
    goal: str(formData.get("goal")) || null,
  });
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Edita título, descripción y meta de una tarea. */
export async function updateTask(formData: FormData): Promise<void> {
  const id = str(formData.get("id"));
  const title = str(formData.get("title"));
  if (!id) throw new Error("Falta el id de la tarea");
  if (!title) throw new Error("El título es obligatorio");

  const { error } = await getSupabase()
    .from("tasks")
    .update({
      title,
      description: str(formData.get("description")) || null,
      goal: str(formData.get("goal")) || null,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Activa/desactiva una tarea sin perder historial. */
export async function setTaskActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await getSupabase()
    .from("tasks")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Eliminación lógica: oculta la tarea pero conserva sus logs para reportes. */
export async function softDeleteTask(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("tasks")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}

/** Restaura una tarea eliminada lógicamente. */
export async function restoreTask(id: string): Promise<void> {
  const { error } = await getSupabase()
    .from("tasks")
    .update({ deleted_at: null, is_active: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidateAll();
}
