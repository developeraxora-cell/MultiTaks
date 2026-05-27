import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import type { Usuario } from "@/lib/types";

const PUBLIC_COLS = "id, email, full_name, role, time_zone, is_active, created_at, updated_at";

/** Lista de usuarios (sin password_hash). Solo para admin. */
export async function listUsuarios(): Promise<Usuario[]> {
  const { data, error } = await getSupabase()
    .from("usuarios")
    .select(PUBLIC_COLS)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Usuario[];
}

/** Usuarios paginados (server-side) con total. */
export async function listUsuariosPaged(
  page: number,
  perPage: number,
): Promise<{ rows: Usuario[]; total: number }> {
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, count, error } = await getSupabase()
    .from("usuarios")
    .select(PUBLIC_COLS, { count: "exact" })
    .order("created_at", { ascending: true })
    .range(from, to);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Usuario[], total: count ?? 0 };
}

export async function getUsuario(id: string): Promise<Usuario | null> {
  const { data, error } = await getSupabase()
    .from("usuarios")
    .select(PUBLIC_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Usuario) ?? null;
}

/** Usuario por email INCLUYENDO password_hash — solo para login. */
export async function getUsuarioForAuth(
  email: string,
): Promise<(Usuario & { password_hash: string }) | null> {
  const { data, error } = await getSupabase()
    .from("usuarios")
    .select(`${PUBLIC_COLS}, password_hash`)
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Usuario & { password_hash: string }) ?? null;
}
