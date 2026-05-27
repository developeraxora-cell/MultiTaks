/**
 * Tipos del módulo Fitness / Nutrición IA. Espejan las tablas de
 * `supabase/nutrition.sql`. Puros (sin imports de servidor) → usables tanto en
 * Server como en Client Components.
 */

export type Sex = "masculino" | "femenino" | "otro";

export type MainGoal =
  | "bajar_grasa"
  | "mantener"
  | "ganar_musculo"
  | "mejorar_habitos"
  | "comer_saludable"
  | "rendimiento";

export type ActivityLevel = "sedentario" | "ligero" | "moderado" | "alto" | "muy_alto";

export type ExerciseIntensity = "baja" | "media" | "alta";

export type FoodStyle =
  | "casera"
  | "economica"
  | "alta_proteina"
  | "rapida"
  | "vegetariana"
  | "balanceada"
  | "flexible";

export type MealType = "desayuno" | "almuerzo" | "cena" | "snack";

export type NutritionQuality = "muy_baja" | "baja" | "media" | "buena" | "muy_buena";

export interface NutritionProfile {
  id: string;
  user_id: string;
  // Paso 1
  age: number | null;
  sex: Sex | null;
  weight_kg: number | null;
  height_cm: number | null;
  country: string | null;
  meals_per_day: number | null;
  meal_times: string | null;
  // Paso 2 — CSV de MainGoal (puede tener varios objetivos)
  main_goal: string | null;
  goal_description: string | null;
  // Paso 3
  activity_level: ActivityLevel | null;
  exercise_type: string | null;
  exercise_days_week: number | null;
  exercise_minutes: number | null;
  exercise_intensity: ExerciseIntensity | null;
  // Paso 4
  favorite_foods: string | null;
  frequent_foods: string | null;
  disliked_foods: string | null;
  avoid_foods: string | null;
  food_style: FoodStyle | null;
  // Paso 5
  allergies: string | null;
  intolerances: string | null;
  dietary_restrictions: string | null;
  health_notes: string | null;

  onboarding_completed: boolean;
  onboarding_step: number;
  created_at: string;
  updated_at: string;
}

export interface NutritionGoal {
  id: string;
  user_id: string;
  profile_id: string | null;
  daily_calories: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  daily_fiber_g: number | null;
  daily_water_l: number | null;
  daily_vegetable_servings: number | null;
  weekly_calories: number | null;
  goal_summary: string | null;
  ai_recommendations: string | null;
  source: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Micronutrients {
  [key: string]: string; // ej. { iron: "medio", calcium: "bajo" }
}

export interface MealLog {
  id: string;
  user_id: string;
  logged_at: string;
  log_date: string; // YYYY-MM-DD
  meal_type: MealType | null;
  meal_name: string;
  image_url: string | null;
  image_path: string | null;
  detected_foods: string[] | null;
  portion_estimate: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  micronutrients: Micronutrients | null;
  nutrition_quality: NutritionQuality | null;
  nutrition_quality_score: number | null;
  ai_analysis: string | null;
  ai_recommendation: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyNutritionSummary {
  id: string;
  user_id: string;
  summary_date: string;
  total_calories: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  total_fiber_g: number;
  meals_count: number;
  avg_quality_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface NutritionChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Resultado del análisis de imagen de IA (estructura que devuelve el servicio). */
export interface MealAnalysis {
  meal_name: string;
  meal_type: MealType;
  detected_foods: string[];
  portion_estimate: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  micronutrients: Micronutrients;
  nutrition_quality: NutritionQuality;
  nutrition_quality_score: number;
  ai_analysis: string;
  ai_recommendation: string;
}

/** Metas que devuelve el generador de IA. */
export interface GeneratedGoals {
  daily_calories: number;
  daily_protein_g: number;
  daily_carbs_g: number;
  daily_fat_g: number;
  daily_fiber_g: number;
  daily_water_l: number;
  daily_vegetable_servings: number;
  weekly_calories: number;
  goal_summary: string;
  ai_recommendations: string;
}

// ---------------------------------------------------------------------------
//  Etiquetas legibles (es) para selects y vistas.
// ---------------------------------------------------------------------------
export const MAIN_GOAL_LABELS: Record<MainGoal, string> = {
  bajar_grasa: "Bajar grasa",
  mantener: "Mantener peso",
  ganar_musculo: "Ganar masa muscular",
  mejorar_habitos: "Mejorar hábitos alimenticios",
  comer_saludable: "Comer más saludable",
  rendimiento: "Mejorar rendimiento físico",
};

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentario: "Sedentario",
  ligero: "Ligero",
  moderado: "Moderado",
  alto: "Alto",
  muy_alto: "Muy alto",
};

export const FOOD_STYLE_LABELS: Record<FoodStyle, string> = {
  casera: "Casera",
  economica: "Económica",
  alta_proteina: "Alta en proteína",
  rapida: "Rápida",
  vegetariana: "Vegetariana",
  balanceada: "Balanceada",
  flexible: "Flexible",
};

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  desayuno: "Desayuno",
  almuerzo: "Almuerzo",
  cena: "Cena",
  snack: "Snack",
};

export const QUALITY_LABELS: Record<NutritionQuality, string> = {
  muy_baja: "Muy baja",
  baja: "Baja",
  media: "Media",
  buena: "Buena",
  muy_buena: "Muy buena",
};

export const SEX_LABELS: Record<Sex, string> = {
  masculino: "Masculino",
  femenino: "Femenino",
  otro: "Otro",
};

export const INTENSITY_LABELS: Record<ExerciseIntensity, string> = {
  baja: "Baja",
  media: "Media",
  alta: "Alta",
};
