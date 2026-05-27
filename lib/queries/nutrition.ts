import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import { profileFromDb } from "@/lib/nutrition/db-map";
import type {
  DailyNutritionSummary,
  MealLog,
  NutritionChatMessage,
  NutritionGoal,
  NutritionProfile,
} from "@/lib/nutrition/types";

// ---------------------------------------------------------------------------
//  Perfil nutricional
// ---------------------------------------------------------------------------

/** Perfil nutricional del usuario (o null si aún no existe). */
export async function getNutritionProfileByUserId(
  userId: string,
): Promise<NutritionProfile | null> {
  const { data, error } = await getSupabase()
    .from("nutrition_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? profileFromDb(data as Record<string, unknown>) : null;
}

// ---------------------------------------------------------------------------
//  Metas
// ---------------------------------------------------------------------------

/** Meta nutricional activa del usuario (la más reciente activa). */
export async function getActiveNutritionGoal(userId: string): Promise<NutritionGoal | null> {
  const { data, error } = await getSupabase()
    .from("nutrition_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as NutritionGoal) ?? null;
}

// ---------------------------------------------------------------------------
//  Comidas
// ---------------------------------------------------------------------------

/** Comidas de un día concreto (orden cronológico). */
export async function getMealLogsByDate(userId: string, date: string): Promise<MealLog[]> {
  const { data, error } = await getSupabase()
    .from("meal_logs")
    .select("*")
    .eq("user_id", userId)
    .eq("log_date", date)
    .order("logged_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as MealLog[];
}

/** Comidas de hoy. `today` = clave YYYY-MM-DD en hora local (la calcula la página). */
export function getTodayMealLogs(userId: string, today: string): Promise<MealLog[]> {
  return getMealLogsByDate(userId, today);
}

/** Comidas dentro de un rango de fechas (historial / progreso). */
export async function getMealLogsInRange(
  userId: string,
  start: string,
  end: string,
): Promise<MealLog[]> {
  const { data, error } = await getSupabase()
    .from("meal_logs")
    .select("*")
    .eq("user_id", userId)
    .gte("log_date", start)
    .lte("log_date", end)
    .order("logged_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MealLog[];
}

export async function getMealLog(id: string, userId: string): Promise<MealLog | null> {
  const { data, error } = await getSupabase()
    .from("meal_logs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as MealLog) ?? null;
}

// ---------------------------------------------------------------------------
//  Resumen diario
// ---------------------------------------------------------------------------

export async function getDailySummary(
  userId: string,
  date: string,
): Promise<DailyNutritionSummary | null> {
  const { data, error } = await getSupabase()
    .from("daily_nutrition_summaries")
    .select("*")
    .eq("user_id", userId)
    .eq("summary_date", date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DailyNutritionSummary) ?? null;
}

/** Resúmenes diarios en un rango (para gráficos de progreso). */
export async function getDailySummariesInRange(
  userId: string,
  start: string,
  end: string,
): Promise<DailyNutritionSummary[]> {
  const { data, error } = await getSupabase()
    .from("daily_nutrition_summaries")
    .select("*")
    .eq("user_id", userId)
    .gte("summary_date", start)
    .lte("summary_date", end)
    .order("summary_date", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as DailyNutritionSummary[];
}

// ---------------------------------------------------------------------------
//  Chat
// ---------------------------------------------------------------------------

/** Historial de chat del usuario (orden cronológico, últimos `limit`). */
export async function getChatMessages(
  userId: string,
  limit = 50,
): Promise<NutritionChatMessage[]> {
  const { data, error } = await getSupabase()
    .from("nutrition_chat_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  // Vuelve a orden ascendente para pintar de arriba a abajo.
  return ((data ?? []) as NutritionChatMessage[]).reverse();
}
