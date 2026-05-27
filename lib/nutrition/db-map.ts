import "server-only";

import type {
  DailyNutritionSummary,
  MealLog,
  NutritionGoal,
  NutritionProfile,
} from "./types";

/**
 * Mapeo entre el esquema REAL de la base (creado por el SQL base del proyecto:
 * arrays text[], jsonb y nombres propios) y los tipos internos de la app.
 *
 * - Arrays text[]  ↔  CSV "a,b,c" (representación interna en formularios).
 * - usual_meal_times (jsonb)  ↔  CSV de horas.
 * - Renombres: foods_to_avoid↔avoid_foods, restrictions↔dietary_restrictions,
 *   usual_meal_times↔meal_times, food_preference_type↔food_style,
 *   onboarding_current_step↔onboarding_step, exercise_days_per_week↔exercise_days_week,
 *   exercise_duration_minutes↔exercise_minutes.
 * - PostgREST devuelve `numeric` como string → se coacciona a número.
 */

// --- helpers ----------------------------------------------------------------
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function numOr0(v: unknown): number {
  return num(v) ?? 0;
}

/** text[] de la DB → CSV interno. */
function arrToCsv(v: unknown): string | null {
  if (Array.isArray(v)) return v.length ? v.map(String).join(",") : null;
  if (typeof v === "string" && v) return v; // por si alguna quedó como text
  return null;
}
/** CSV interno → text[] para la DB (null si vacío). */
function csvToArr(csv: string | null | undefined): string[] | null {
  if (csv == null) return null;
  const arr = csv.split(",").map((s) => s.trim()).filter(Boolean);
  return arr.length ? arr : null;
}
/** jsonb (array) → CSV. */
function jsonbToCsv(v: unknown): string | null {
  if (Array.isArray(v)) return v.length ? v.map(String).join(",") : null;
  if (typeof v === "string" && v) return v;
  return null;
}

function firstCsv(...values: unknown[]): string | null {
  for (const value of values) {
    const csv = arrToCsv(value);
    if (csv) return csv;
  }
  return null;
}

// === nutrition_profiles =====================================================

export function profileFromDb(row: Record<string, unknown>): NutritionProfile {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    age: num(row.age),
    sex: (row.sex as NutritionProfile["sex"]) ?? null,
    weight_kg: num(row.weight_kg),
    height_cm: num(row.height_cm),
    country: (row.country as string) ?? null,
    meals_per_day: num(row.meals_per_day),
    meal_times: jsonbToCsv(row.usual_meal_times) ?? arrToCsv(row.meal_times),
    main_goal: (row.main_goal as string) ?? null,
    goal_description: (row.goal_description as string) ?? null,
    activity_level: (row.activity_level as NutritionProfile["activity_level"]) ?? null,
    exercise_type: (row.exercise_type as string) ?? null,
    exercise_days_week: num(row.exercise_days_per_week),
    exercise_minutes: num(row.exercise_duration_minutes),
    exercise_intensity: (row.exercise_intensity as NutritionProfile["exercise_intensity"]) ?? null,
    favorite_foods: arrToCsv(row.favorite_foods),
    frequent_foods: arrToCsv(row.frequent_foods),
    disliked_foods: arrToCsv(row.disliked_foods),
    avoid_foods: firstCsv(row.foods_to_avoid, row.avoid_foods),
    food_style:
      (row.food_preference_type as NutritionProfile["food_style"]) ??
      (row.food_style as NutritionProfile["food_style"]) ??
      null,
    allergies: arrToCsv(row.allergies),
    intolerances: arrToCsv(row.intolerances),
    dietary_restrictions: firstCsv(row.restrictions, row.dietary_restrictions),
    health_notes: (row.health_notes as string) ?? null,
    onboarding_completed: Boolean(row.onboarding_completed),
    onboarding_step: num(row.onboarding_current_step) ?? num(row.onboarding_step) ?? 0,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/**
 * Campos de la app → columnas reales de la DB. Solo incluye las claves presentes
 * en `app` (para updates parciales / guardado por pasos del onboarding).
 */
export function profileToDb(app: Partial<NutritionProfile>): Record<string, unknown> {
  const db: Record<string, unknown> = {};
  const has = (k: keyof NutritionProfile) => k in app;
  const set = (dbKey: string, val: unknown) => {
    db[dbKey] = val;
  };

  if (has("age")) set("age", app.age);
  if (has("sex")) set("sex", app.sex);
  if (has("weight_kg")) set("weight_kg", app.weight_kg);
  if (has("height_cm")) set("height_cm", app.height_cm);
  if (has("country")) set("country", app.country);
  if (has("meals_per_day")) set("meals_per_day", app.meals_per_day);
  if (has("meal_times")) set("usual_meal_times", csvToArr(app.meal_times));
  if (has("main_goal")) set("main_goal", app.main_goal);
  if (has("goal_description")) set("goal_description", app.goal_description);
  if (has("activity_level")) set("activity_level", app.activity_level);
  if (has("exercise_type")) set("exercise_type", app.exercise_type);
  if (has("exercise_days_week")) set("exercise_days_per_week", app.exercise_days_week);
  if (has("exercise_minutes")) set("exercise_duration_minutes", app.exercise_minutes);
  if (has("exercise_intensity")) set("exercise_intensity", app.exercise_intensity);
  if (has("favorite_foods")) set("favorite_foods", csvToArr(app.favorite_foods));
  if (has("frequent_foods")) set("frequent_foods", csvToArr(app.frequent_foods));
  if (has("disliked_foods")) set("disliked_foods", csvToArr(app.disliked_foods));
  if (has("avoid_foods")) set("foods_to_avoid", csvToArr(app.avoid_foods));
  if (has("food_style")) set("food_preference_type", app.food_style);
  if (has("allergies")) set("allergies", csvToArr(app.allergies));
  if (has("intolerances")) set("intolerances", csvToArr(app.intolerances));
  if (has("dietary_restrictions")) set("restrictions", csvToArr(app.dietary_restrictions));
  if (has("health_notes")) set("health_notes", app.health_notes);
  if (has("onboarding_completed")) set("onboarding_completed", app.onboarding_completed);
  if (has("onboarding_step")) set("onboarding_current_step", app.onboarding_step);

  return db;
}

// === nutrition_goals ========================================================

export function goalFromDb(row: Record<string, unknown>): NutritionGoal {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    profile_id: (row.profile_id as string) ?? null,
    daily_calories: num(row.daily_calories),
    daily_protein_g: num(row.daily_protein_g),
    daily_carbs_g: num(row.daily_carbs_g),
    daily_fat_g: num(row.daily_fat_g),
    daily_fiber_g: num(row.daily_fiber_g),
    daily_water_l: num(row.daily_water_l),
    daily_vegetable_servings: num(row.daily_vegetable_servings),
    weekly_calories: num(row.weekly_calories),
    goal_summary: (row.goal_summary as string) ?? null,
    ai_recommendations: (row.ai_recommendations as string) ?? null,
    source: String(row.source ?? "ai_mock"),
    is_active: Boolean(row.is_active),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

// === meal_logs ==============================================================

export function mealFromDb(row: Record<string, unknown>): MealLog {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    logged_at: String(row.logged_at ?? ""),
    log_date: String(row.log_date ?? ""),
    meal_type: (row.meal_type as MealLog["meal_type"]) ?? null,
    meal_name: String(row.meal_name ?? ""),
    image_url: (row.image_url as string) ?? null,
    image_path: (row.image_path as string) ?? null,
    detected_foods: Array.isArray(row.detected_foods)
      ? (row.detected_foods as unknown[]).map(String)
      : null,
    portion_estimate: (row.portion_estimate as string) ?? null,
    calories: numOr0(row.calories),
    protein_g: numOr0(row.protein_g),
    carbs_g: numOr0(row.carbs_g),
    fat_g: numOr0(row.fat_g),
    fiber_g: numOr0(row.fiber_g),
    micronutrients: (row.micronutrients as MealLog["micronutrients"]) ?? null,
    nutrition_quality: (row.nutrition_quality as MealLog["nutrition_quality"]) ?? null,
    nutrition_quality_score: num(row.nutrition_quality_score),
    ai_analysis: (row.ai_analysis as string) ?? null,
    ai_recommendation: (row.ai_recommendation as string) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

// === daily_nutrition_summaries =============================================

export function summaryFromDb(row: Record<string, unknown>): DailyNutritionSummary {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    summary_date: String(row.summary_date ?? ""),
    total_calories: numOr0(row.total_calories),
    total_protein_g: numOr0(row.total_protein_g),
    total_carbs_g: numOr0(row.total_carbs_g),
    total_fat_g: numOr0(row.total_fat_g),
    total_fiber_g: numOr0(row.total_fiber_g),
    meals_count: numOr0(row.meals_count),
    avg_quality_score: num(row.average_quality_score),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}
