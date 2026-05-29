"use server";

import { revalidatePath } from "next/cache";

import { getSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import {
  analyzeMeal,
  chatReply,
  generateGoals,
  isAiConfigured,
  type ChatContext,
} from "@/lib/nutrition/ai";
import {
  getActiveNutritionGoal,
  getNutritionProfileByUserId,
} from "@/lib/queries/nutrition";
import { todayKey } from "@/lib/date";
import { deleteCloudinaryImage, uploadMealImageToCloudinary } from "@/lib/cloudinary/server";
import { profileFromDb, profileToDb } from "@/lib/nutrition/db-map";
import type {
  GeneratedGoals,
  MealAnalysis,
  MealType,
  NutritionProfile,
} from "@/lib/nutrition/types";

function revalidateModule() {
  revalidatePath("/nutricion");
  revalidatePath("/nutricion/dashboard");
  revalidatePath("/nutricion/historial");
  revalidatePath("/nutricion/progreso");
  revalidatePath("/nutricion/perfil");
}

// ---- helpers de parseo de FormData -----------------------------------------
function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}
function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = str(v);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function num(v: FormDataEntryValue | null, fallback = 0): number {
  const n = numOrNull(v);
  return n ?? fallback;
}

/** Campos del perfil que vienen del onboarding / edición (todos opcionales). */
function profileFieldsFromForm(fd: FormData): Partial<NutritionProfile> {
  return {
    // Paso 1
    age: numOrNull(fd.get("age")),
    sex: (strOrNull(fd.get("sex")) as NutritionProfile["sex"]) ?? null,
    weight_kg: numOrNull(fd.get("weight_kg")),
    height_cm: numOrNull(fd.get("height_cm")),
    country: strOrNull(fd.get("country")),
    meals_per_day: numOrNull(fd.get("meals_per_day")),
    meal_times: strOrNull(fd.get("meal_times")),
    // Paso 2
    main_goal: (strOrNull(fd.get("main_goal")) as NutritionProfile["main_goal"]) ?? null,
    goal_description: strOrNull(fd.get("goal_description")),
    // Paso 3
    activity_level:
      (strOrNull(fd.get("activity_level")) as NutritionProfile["activity_level"]) ?? null,
    exercise_type: strOrNull(fd.get("exercise_type")),
    exercise_days_week: numOrNull(fd.get("exercise_days_week")),
    exercise_minutes: numOrNull(fd.get("exercise_minutes")),
    exercise_intensity:
      (strOrNull(fd.get("exercise_intensity")) as NutritionProfile["exercise_intensity"]) ?? null,
    // Paso 4
    favorite_foods: strOrNull(fd.get("favorite_foods")),
    frequent_foods: strOrNull(fd.get("frequent_foods")),
    disliked_foods: strOrNull(fd.get("disliked_foods")),
    avoid_foods: strOrNull(fd.get("avoid_foods")),
    food_style: (strOrNull(fd.get("food_style")) as NutritionProfile["food_style"]) ?? null,
    // Paso 5
    allergies: strOrNull(fd.get("allergies")),
    intolerances: strOrNull(fd.get("intolerances")),
    dietary_restrictions: strOrNull(fd.get("dietary_restrictions")),
    health_notes: strOrNull(fd.get("health_notes")),
  };
}

/** Inserta o actualiza el perfil del usuario con los campos dados. Devuelve el perfil. */
async function upsertProfile(
  userId: string,
  fields: Partial<NutritionProfile>,
): Promise<NutritionProfile> {
  const sb = getSupabase();
  const existing = await getNutritionProfileByUserId(userId);
  const dbFields = profileToDb(fields);

  if (existing) {
    const { data, error } = await sb
      .from("nutrition_profiles")
      .update(dbFields)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return profileFromDb(data as Record<string, unknown>);
  }

  const { data, error } = await sb
    .from("nutrition_profiles")
    .insert({ user_id: userId, ...dbFields })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return profileFromDb(data as Record<string, unknown>);
}

// ===========================================================================
//  Onboarding
// ===========================================================================

/**
 * Guarda el progreso de un paso del onboarding sin completarlo. Permite reanudar
 * más tarde desde `onboarding_step`.
 */
export async function saveOnboardingStep(step: number, fd: FormData): Promise<void> {
  const session = await requireUser();
  await upsertProfile(session.userId, {
    ...profileFieldsFromForm(fd),
    onboarding_step: step,
  });
  revalidateModule();
}

/**
 * Completa el onboarding: guarda el perfil, marca onboarding_completed=true,
 * genera metas con IA y las guarda como meta activa.
 */
export async function completeNutritionOnboarding(fd: FormData): Promise<GeneratedGoals> {
  const session = await requireUser();
  const profile = await upsertProfile(session.userId, {
    ...profileFieldsFromForm(fd),
    onboarding_completed: true,
    onboarding_step: 8,
  });

  const goals = await generateAndSaveGoals(session.userId, profile);
  revalidateModule();
  return goals;
}

// ===========================================================================
//  Perfil (edición posterior)
// ===========================================================================

export async function updateNutritionProfile(fd: FormData): Promise<void> {
  const session = await requireUser();
  await upsertProfile(session.userId, profileFieldsFromForm(fd));
  revalidateModule();
}

// ===========================================================================
//  Metas
// ===========================================================================

/** Genera metas con IA y las guarda, desactivando las anteriores. */
async function generateAndSaveGoals(
  userId: string,
  profile: NutritionProfile,
): Promise<GeneratedGoals> {
  const goals = await generateGoals(profile);
  const sb = getSupabase();

  // Auditoría de la llamada a IA.
  await sb.from("ai_nutrition_requests").insert({
    user_id: userId,
    request_type: "goals",
    is_mock: !isAiConfigured(),
    request_payload: { profile_id: profile.id, main_goal: profile.main_goal },
    response_payload: goals,
  });

  // Desactiva metas previas y guarda la nueva como activa.
  await sb.from("nutrition_goals").update({ is_active: false }).eq("user_id", userId);
  const { error } = await sb.from("nutrition_goals").insert({
    user_id: userId,
    profile_id: profile.id,
    daily_calories: goals.daily_calories,
    daily_protein_g: goals.daily_protein_g,
    daily_carbs_g: goals.daily_carbs_g,
    daily_fat_g: goals.daily_fat_g,
    daily_fiber_g: goals.daily_fiber_g,
    daily_water_l: goals.daily_water_l,
    daily_vegetable_servings: goals.daily_vegetable_servings,
    weekly_calories: goals.weekly_calories,
    goal_summary: goals.goal_summary,
    ai_recommendations: goals.ai_recommendations,
    source: isAiConfigured() ? "ai" : "ai_mock",
    is_active: true,
  });
  if (error) throw new Error(error.message);
  return goals;
}

/** Regenera las metas a partir del perfil actual (botón "recalcular"). */
export async function regenerateNutritionGoals(): Promise<void> {
  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  if (!profile) throw new Error("No existe un perfil nutricional");
  await generateAndSaveGoals(session.userId, profile);
  revalidateModule();
}

// ===========================================================================
//  Análisis de comida (subir imagen + IA). No guarda todavía: el usuario revisa.
// ===========================================================================

export interface AnalyzeResult {
  analysis: MealAnalysis;
  image_url: string | null;
  image_path: string | null;
}

/**
 * Sube la imagen a Cloudinary (si viene) y la analiza con IA. Devuelve el análisis
 * y las referencias de imagen para que el usuario revise/edite antes de guardar.
 */
export async function analyzeMealImage(fd: FormData): Promise<AnalyzeResult> {
  const session = await requireUser();
  const file = fd.get("image");
  const note = strOrNull(fd.get("note"));

  let image_url: string | null = null;
  let image_path: string | null = null;
  let bytes = 0;
  let name = "meal";
  let dataUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    bytes = file.size;
    name = file.name || "meal";
    const mime = file.type || "image/jpeg";
    const buffer = Buffer.from(await file.arrayBuffer());
    // data URL para que el modelo de visión (Ollama/llava, etc.) pueda "ver" la foto.
    dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;

    const uploaded = await uploadMealImageToCloudinary({
      buffer,
      mime,
      userId: session.userId,
      fileName: name,
    });
    image_path = uploaded.publicId;
    image_url = uploaded.url;
  }

  const analysis = await analyzeMeal({ bytes, name, dataUrl, note });

  // Auditoría.
  await getSupabase().from("ai_nutrition_requests").insert({
    user_id: session.userId,
    request_type: "meal_analysis",
    is_mock: !isAiConfigured(),
    request_payload: { image_provider: "cloudinary", image_path, bytes, note },
    response_payload: analysis,
  });

  return { analysis, image_url, image_path };
}

// ===========================================================================
//  Guardar / editar / borrar comida + recalcular resumen diario
// ===========================================================================

/** Crea una comida (tras confirmar el análisis editado por el usuario). */
export async function createMealLog(fd: FormData): Promise<void> {
  const session = await requireUser();
  const meal_name = str(fd.get("meal_name"));
  if (!meal_name) throw new Error("El nombre de la comida es obligatorio");

  const log_date = strOrNull(fd.get("log_date")) ?? todayServer(session.timeZone);
  const detectedRaw = strOrNull(fd.get("detected_foods"));
  const microRaw = strOrNull(fd.get("micronutrients"));

  const { error } = await getSupabase().from("meal_logs").insert({
    user_id: session.userId,
    log_date,
    meal_type: (strOrNull(fd.get("meal_type")) as MealType) ?? null,
    meal_name,
    image_url: strOrNull(fd.get("image_url")),
    image_path: strOrNull(fd.get("image_path")),
    detected_foods: detectedRaw ? safeJsonArray(detectedRaw) : null,
    portion_estimate: strOrNull(fd.get("portion_estimate")),
    calories: num(fd.get("calories")),
    protein_g: num(fd.get("protein_g")),
    carbs_g: num(fd.get("carbs_g")),
    fat_g: num(fd.get("fat_g")),
    fiber_g: num(fd.get("fiber_g")),
    micronutrients: microRaw ? safeJsonObject(microRaw) : null,
    nutrition_quality: strOrNull(fd.get("nutrition_quality")),
    nutrition_quality_score: numOrNull(fd.get("nutrition_quality_score")),
    ai_analysis: strOrNull(fd.get("ai_analysis")),
    ai_recommendation: strOrNull(fd.get("ai_recommendation")),
  });
  if (error) throw new Error(error.message);

  await recalcDailySummary(session.userId, log_date);
  revalidateModule();
}

/** Edita los campos de una comida ya guardada y recalcula el resumen. */
export async function updateMealLog(fd: FormData): Promise<void> {
  const session = await requireUser();
  const id = str(fd.get("id"));
  if (!id) throw new Error("Falta el id de la comida");

  const { data, error } = await getSupabase()
    .from("meal_logs")
    .update({
      meal_name: str(fd.get("meal_name")),
      meal_type: (strOrNull(fd.get("meal_type")) as MealType) ?? null,
      portion_estimate: strOrNull(fd.get("portion_estimate")),
      calories: num(fd.get("calories")),
      protein_g: num(fd.get("protein_g")),
      carbs_g: num(fd.get("carbs_g")),
      fat_g: num(fd.get("fat_g")),
      fiber_g: num(fd.get("fiber_g")),
    })
    .eq("id", id)
    .eq("user_id", session.userId)
    .select("log_date")
    .single();
  if (error) throw new Error(error.message);

  await recalcDailySummary(session.userId, (data as { log_date: string }).log_date);
  revalidateModule();
}

/** Borra una comida y recalcula el resumen de su día. */
export async function deleteMealLog(id: string): Promise<void> {
  const session = await requireUser();
  const sb = getSupabase();

  const { data: row } = await sb
    .from("meal_logs")
    .select("log_date, image_path")
    .eq("id", id)
    .eq("user_id", session.userId)
    .maybeSingle();

  const { error } = await sb
    .from("meal_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId);
  if (error) throw new Error(error.message);

  const r = row as { log_date: string; image_path: string | null } | null;
  if (r?.image_path) {
    await deleteCloudinaryImage(r.image_path);
  }
  if (r?.log_date) await recalcDailySummary(session.userId, r.log_date);
  revalidateModule();
}

/**
 * Recalcula (upsert) el resumen diario de un usuario para una fecha a partir de
 * todas sus comidas de ese día.
 */
export async function recalcDailySummary(userId: string, date: string): Promise<void> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("meal_logs")
    .select("calories, protein_g, carbs_g, fat_g, fiber_g, nutrition_quality_score")
    .eq("user_id", userId)
    .eq("log_date", date);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    nutrition_quality_score: number | null;
  }>;

  const totals = rows.reduce(
    (acc, r) => {
      acc.cal += Number(r.calories) || 0;
      acc.prot += Number(r.protein_g) || 0;
      acc.carb += Number(r.carbs_g) || 0;
      acc.fat += Number(r.fat_g) || 0;
      acc.fib += Number(r.fiber_g) || 0;
      if (r.nutrition_quality_score != null) {
        acc.qSum += Number(r.nutrition_quality_score);
        acc.qCount += 1;
      }
      return acc;
    },
    { cal: 0, prot: 0, carb: 0, fat: 0, fib: 0, qSum: 0, qCount: 0 },
  );

  const { error: upErr } = await sb.from("daily_nutrition_summaries").upsert(
    {
      user_id: userId,
      summary_date: date,
      total_calories: Math.round(totals.cal),
      total_protein_g: totals.prot,
      total_carbs_g: totals.carb,
      total_fat_g: totals.fat,
      total_fiber_g: totals.fib,
      meals_count: rows.length,
      avg_quality_score: totals.qCount > 0 ? totals.qSum / totals.qCount : null,
    },
    { onConflict: "user_id,summary_date" },
  );
  if (upErr) throw new Error(upErr.message);
}

// ===========================================================================
//  Chat
// ===========================================================================

/** Guarda el mensaje del usuario, obtiene respuesta de IA, la guarda y la devuelve. */
export async function sendNutritionChatMessage(message: string): Promise<string> {
  const session = await requireUser();
  const text = message.trim();
  if (!text) throw new Error("El mensaje está vacío");

  const sb = getSupabase();
  await sb.from("nutrition_chat_messages").insert({
    user_id: session.userId,
    role: "user",
    content: text,
  });

  // Contexto para la IA: perfil, meta activa y consumo de hoy.
  const [profile, goal] = await Promise.all([
    getNutritionProfileByUserId(session.userId),
    getActiveNutritionGoal(session.userId),
  ]);

  const today = todayServer(session.timeZone);
  const { data: summary } = await sb
    .from("daily_nutrition_summaries")
    .select("total_calories")
    .eq("user_id", session.userId)
    .eq("summary_date", today)
    .maybeSingle();

  const consumed = Number((summary as { total_calories: number } | null)?.total_calories ?? 0);
  const ctx: ChatContext = {
    profile,
    goal,
    caloriesConsumed: consumed,
    caloriesRemaining: (goal?.daily_calories ?? 2000) - consumed,
  };

  const reply = await chatReply(text, ctx);

  await sb.from("nutrition_chat_messages").insert({
    user_id: session.userId,
    role: "assistant",
    content: reply,
  });
  await sb.from("ai_nutrition_requests").insert({
    user_id: session.userId,
    request_type: "chat",
    is_mock: !isAiConfigured(),
    request_payload: { message: text },
    response_payload: { reply },
  });

  revalidatePath("/nutricion/chat");
  return reply;
}

// ---------------------------------------------------------------------------
function safeJsonArray(s: string): string[] | null {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : null;
  } catch {
    // CSV de respaldo
    return s.split(",").map((x) => x.trim()).filter(Boolean);
  }
}
function safeJsonObject(s: string): Record<string, string> | null {
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? (v as Record<string, string>) : null;
  } catch {
    return null;
  }
}

/** Fecha operativa de la app (YYYY-MM-DD) según APP_TIME_ZONE. */
function todayServer(timeZone: string): string {
  return todayKey(timeZone);
}
