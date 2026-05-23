"use server";

import { redirect } from "next/navigation";
import { getUsuarioForAuth } from "@/lib/queries/users";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionCookie, clearSessionCookie } from "@/lib/auth/server";

export interface LoginState {
  error?: string;
}

/** Login con email + contraseña. Usar con useActionState. */
export async function signIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!identifier || !password) return { error: "Completa usuario y contraseña" };

  const user = await getUsuarioForAuth(identifier);
  if (!user || !user.is_active) return { error: "Credenciales inválidas" };

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return { error: "Credenciales inválidas" };

  await createSessionCookie({ userId: user.id, role: user.role, name: user.full_name });
  redirect("/home");
}

export async function signOut(): Promise<void> {
  await clearSessionCookie();
  redirect("/login");
}
