import "server-only";

import { hash, compare } from "bcryptjs";

/** Hash bcrypt de una contraseña en claro. */
export function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

/** Compara contraseña en claro contra hash bcrypt (compatible con pgcrypto $2a$). */
export function verifyPassword(plain: string, hashStr: string): Promise<boolean> {
  return compare(plain, hashStr);
}
