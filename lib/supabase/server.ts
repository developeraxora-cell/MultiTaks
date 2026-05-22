import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase de servidor.
 *
 * Usa la `service_role` key, que tiene acceso total a la base de datos saltándose
 * RLS. Por eso este módulo importa `server-only`: si alguien lo importa desde un
 * Client Component el build falla, evitando filtrar la key al navegador.
 *
 * App personal de un solo usuario → todo el acceso a datos pasa por aquí, desde
 * Server Components y Server Actions.
 */

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** `true` cuando las variables de entorno de Supabase están presentes. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && serviceRoleKey);
}

let client: SupabaseClient | null = null;

/**
 * Devuelve el cliente Supabase (singleton). Lanza si falta configuración: las
 * páginas deben comprobar `isSupabaseConfigured()` antes de llamar a esto y
 * mostrar el aviso de setup.
 */
export function getSupabase(): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase no está configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
  }
  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
