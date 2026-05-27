"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase/server";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/server";
import { normalizeTimeZone } from "@/lib/date";
import type { Role } from "@/lib/types";

/** Crea un usuario. Solo admin. */
export async function createUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role: Role = formData.get("role") === "admin" ? "admin" : "user";
  const time_zone = normalizeTimeZone(String(formData.get("time_zone") ?? ""));

  if (!email || !fullName || !password) throw new Error("Email, nombre y contraseña son obligatorios");
  if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");

  const password_hash = await hashPassword(password);
  const { error } = await getSupabase()
    .from("usuarios")
    .insert({ email, full_name: fullName, password_hash, role, time_zone });
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un usuario con ese email");
    throw new Error(error.message);
  }
  revalidatePath("/admin/users");
}

/** Edita nombre, email/usuario y (opcional) contraseña. Solo admin. */
export async function updateUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const time_zone = normalizeTimeZone(String(formData.get("time_zone") ?? ""));
  if (!id) throw new Error("Falta el id del usuario");
  if (!email || !fullName) throw new Error("Email y nombre son obligatorios");

  const patch: Record<string, string> = { email, full_name: fullName, time_zone };
  if (password) {
    if (password.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
    patch.password_hash = await hashPassword(password);
  }

  const { error } = await getSupabase().from("usuarios").update(patch).eq("id", id);
  if (error) {
    if (error.code === "23505") throw new Error("Ya existe un usuario con ese email");
    throw new Error(error.message);
  }
  revalidatePath("/admin/users");
}

/** Activa/desactiva un usuario. Solo admin. */
export async function setUserActive(id: string, isActive: boolean): Promise<void> {
  await requireAdmin();
  const { error } = await getSupabase()
    .from("usuarios")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

/** Cambia la contraseña de un usuario. Solo admin. */
export async function resetPassword(id: string, newPassword: string): Promise<void> {
  await requireAdmin();
  if (newPassword.length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres");
  const password_hash = await hashPassword(newPassword);
  const { error } = await getSupabase()
    .from("usuarios")
    .update({ password_hash })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}
