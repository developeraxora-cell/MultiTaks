import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionData,
} from "./session";

/** Sesión actual (o null) desde la cookie. Para Server Components / Actions. */
export async function getSession(): Promise<SessionData | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** Crea la cookie de sesión tras un login válido. */
export async function createSessionCookie(data: SessionData): Promise<void> {
  const token = await signSession(data);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Exige sesión; redirige a /login si no hay. */
export async function requireUser(): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige rol admin; redirige si no es admin. */
export async function requireAdmin(): Promise<SessionData> {
  const session = await requireUser();
  if (session.role !== "admin") redirect("/home");
  return session;
}
