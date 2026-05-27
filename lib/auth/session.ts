import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/types";

/**
 * Sesión basada en JWT firmado (HS256). Módulo PURO: solo jose, sin `next/headers`,
 * para poder verificar tokens también en el middleware (edge runtime).
 */

export const SESSION_COOKIE = "mc_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 días

export interface SessionData {
  userId: string;
  role: Role;
  name: string;
  timeZone: string;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET no definido (mínimo 16 caracteres) en .env.local");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(data: SessionData): Promise<string> {
  return new SignJWT({ role: data.role, name: data.name, timeZone: data.timeZone })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(data.userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionData | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (!payload.sub) return null;
    return {
      userId: payload.sub,
      role: (payload.role as Role) ?? "user",
      name: (payload.name as string) ?? "",
      timeZone: (payload.timeZone as string) ?? "America/Mexico_City",
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
