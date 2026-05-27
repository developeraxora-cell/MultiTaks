import "server-only";

import type {
  ActivityLevel,
  GeneratedGoals,
  MainGoal,
  MealAnalysis,
  NutritionGoal,
  NutritionProfile,
  NutritionQuality,
} from "./types";

/**
 * Capa de IA del módulo de nutrición.
 *
 * Funciona contra cualquier endpoint compatible con la API de OpenAI
 * (/chat/completions). Probado para Ollama local; sirve igual para OpenAI,
 * Groq, OpenRouter, etc. Si no hay endpoint configurado, usa MOCKS realistas.
 *
 * IMPORTANTE: este módulo es `server-only`. Las llamadas a IA SIEMPRE salen del
 * servidor (server actions / route handlers), nunca del navegador, para no
 * exponer la API key.
 *
 *   AI_MODEL_API_KEY      — clave del proveedor (OPCIONAL en Ollama). NO uses NEXT_PUBLIC_.
 *   AI_MODEL_BASE_URL     — endpoint compatible OpenAI. Ollama: http://localhost:11434/v1
 *   AI_MODEL_NAME         — modelo de texto (metas + chat). Ej: llama3.1
 *   AI_VISION_MODEL_NAME  — modelo de visión (análisis de fotos). Ej: llava o llama3.2-vision.
 *                           Si falta, el análisis de imagen cae al mock.
 *
 * Ante cualquier error de red/parseo, cada función cae al MOCK para no romper el flujo.
 */

const API_KEY = process.env.AI_MODEL_API_KEY;
const BASE_URL = process.env.AI_MODEL_BASE_URL;
const MODEL_NAME = process.env.AI_MODEL_NAME;
const VISION_MODEL = process.env.AI_VISION_MODEL_NAME;

/** `true` cuando hay endpoint + modelo de texto (la API key es opcional, p.ej. Ollama). */
export function isAiConfigured(): boolean {
  return Boolean(BASE_URL && MODEL_NAME);
}

/** `true` cuando además hay un modelo de visión para analizar fotos de comida. */
export function isVisionConfigured(): boolean {
  return Boolean(BASE_URL && VISION_MODEL);
}

// ===========================================================================
//  1) Generación de metas nutricionales
// ===========================================================================

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  muy_alto: 1.9,
};

/**
 * Objetivo "dominante" de un CSV de objetivos, por prioridad de impacto calórico.
 * (El perfil puede tener varios; para el cálculo mock elegimos uno.)
 */
function primaryGoal(csv: string | null): MainGoal | null {
  const set = new Set((csv ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const priority: MainGoal[] = [
    "ganar_musculo",
    "bajar_grasa",
    "rendimiento",
    "mantener",
    "mejorar_habitos",
    "comer_saludable",
  ];
  return priority.find((g) => set.has(g)) ?? null;
}

/** Ajuste calórico (kcal) y reparto de macros según el objetivo. */
function goalAdjustment(goal: MainGoal | null): {
  kcalDelta: number;
  protein: number; // g por kg de peso
  fatPct: number; // % de calorías de grasa
} {
  switch (goal) {
    case "bajar_grasa":
      return { kcalDelta: -450, protein: 2.0, fatPct: 0.28 };
    case "ganar_musculo":
      return { kcalDelta: 350, protein: 2.0, fatPct: 0.27 };
    case "rendimiento":
      return { kcalDelta: 200, protein: 1.8, fatPct: 0.27 };
    case "mantener":
    case "mejorar_habitos":
    case "comer_saludable":
    default:
      return { kcalDelta: 0, protein: 1.6, fatPct: 0.3 };
  }
}

/**
 * Mock realista de metas: Mifflin-St Jeor (TMB) × factor de actividad + ajuste
 * por objetivo, con reparto de macros estándar. Determinista a partir del perfil.
 */
function mockGoals(profile: NutritionProfile): GeneratedGoals {
  const weight = profile.weight_kg ?? 70;
  const height = profile.height_cm ?? 170;
  const age = profile.age ?? 30;
  const isFemale = profile.sex === "femenino";

  // Mifflin-St Jeor
  const bmr = 10 * weight + 6.25 * height - 5 * age + (isFemale ? -161 : 5);
  const factor = ACTIVITY_FACTOR[profile.activity_level ?? "moderado"] ?? 1.55;
  const tdee = bmr * factor;

  const goal = primaryGoal(profile.main_goal);
  const adj = goalAdjustment(goal);
  const calories = Math.max(1200, Math.round((tdee + adj.kcalDelta) / 10) * 10);

  const protein = Math.round(weight * adj.protein);
  const fat = Math.round((calories * adj.fatPct) / 9);
  const proteinCals = protein * 4;
  const fatCals = fat * 9;
  const carbs = Math.max(0, Math.round((calories - proteinCals - fatCals) / 4));
  const fiber = Math.min(45, Math.max(25, Math.round(calories / 1000 * 14)));
  const water = Math.round((weight * 0.035) * 10) / 10;
  const veggies = goal === "bajar_grasa" ? 5 : 4;

  return {
    daily_calories: calories,
    daily_protein_g: protein,
    daily_carbs_g: carbs,
    daily_fat_g: fat,
    daily_fiber_g: fiber,
    daily_water_l: water,
    daily_vegetable_servings: veggies,
    weekly_calories: calories * 7,
    goal_summary: goalSummary(goal),
    ai_recommendations:
      "Prioriza proteínas magras, carbohidratos complejos y abundantes vegetales. " +
      "Reparte las comidas a lo largo del día y mantén una buena hidratación.",
  };
}

function goalSummary(goal: MainGoal | null): string {
  switch (goal) {
    case "bajar_grasa":
      return "Meta orientada a reducir grasa corporal manteniendo masa muscular con un déficit calórico moderado.";
    case "ganar_musculo":
      return "Meta orientada a ganar masa muscular con un superávit calórico controlado y alta ingesta de proteína.";
    case "rendimiento":
      return "Meta orientada a mejorar el rendimiento físico con energía suficiente y buena recuperación.";
    case "comer_saludable":
      return "Meta orientada a comer más saludable con una alimentación balanceada y rica en nutrientes.";
    case "mejorar_habitos":
      return "Meta orientada a mejorar hábitos alimenticios de forma sostenible y sin restricciones extremas.";
    default:
      return "Meta orientada a mantener el peso con una alimentación balanceada.";
  }
}

/**
 * Genera metas nutricionales para un perfil. Usa el modelo real si está
 * configurado; si no, devuelve un mock realista.
 */
export async function generateGoals(profile: NutritionProfile): Promise<GeneratedGoals> {
  if (isAiConfigured()) {
    return callRealModelGoals(profile);
  }
  // Pequeña latencia simulada para que la UI muestre el estado de carga.
  await delay(450);
  return mockGoals(profile);
}

// ===========================================================================
//  2) Análisis de imagen de comida
// ===========================================================================

const MOCK_MEALS: MealAnalysis[] = [
  {
    meal_name: "Arroz con pollo y ensalada",
    meal_type: "almuerzo",
    detected_foods: ["arroz", "pollo", "lechuga", "tomate"],
    portion_estimate: "1 plato mediano",
    calories: 620,
    protein_g: 35,
    carbs_g: 75,
    fat_g: 18,
    fiber_g: 6,
    micronutrients: { iron: "medio", calcium: "bajo", vitamin_c: "medio", potassium: "medio" },
    nutrition_quality: "media",
    nutrition_quality_score: 65,
    ai_analysis: "Comida balanceada con buena cantidad de proteína y carbohidratos.",
    ai_recommendation: "Podrías agregar más verduras para mejorar la fibra y los micronutrientes.",
  },
  {
    meal_name: "Avena con frutas y nueces",
    meal_type: "desayuno",
    detected_foods: ["avena", "plátano", "fresas", "nueces"],
    portion_estimate: "1 tazón",
    calories: 410,
    protein_g: 12,
    carbs_g: 60,
    fat_g: 13,
    fiber_g: 9,
    micronutrients: { iron: "medio", calcium: "medio", vitamin_c: "alto", potassium: "alto" },
    nutrition_quality: "buena",
    nutrition_quality_score: 82,
    ai_analysis: "Desayuno rico en fibra y carbohidratos complejos, con grasas saludables.",
    ai_recommendation: "Agrega una fuente de proteína (yogur o claras) para mayor saciedad.",
  },
  {
    meal_name: "Hamburguesa con papas fritas",
    meal_type: "almuerzo",
    detected_foods: ["pan", "carne", "queso", "papas fritas"],
    portion_estimate: "1 porción grande",
    calories: 950,
    protein_g: 38,
    carbs_g: 85,
    fat_g: 50,
    fiber_g: 4,
    micronutrients: { iron: "medio", calcium: "medio", vitamin_c: "bajo", potassium: "bajo" },
    nutrition_quality: "baja",
    nutrition_quality_score: 38,
    ai_analysis: "Comida alta en calorías y grasas, con bajo aporte de fibra y vegetales.",
    ai_recommendation: "Acompaña con ensalada y reduce las frituras para equilibrar el día.",
  },
  {
    meal_name: "Salmón al horno con verduras",
    meal_type: "cena",
    detected_foods: ["salmón", "brócoli", "zanahoria", "espárragos"],
    portion_estimate: "1 filete + guarnición",
    calories: 540,
    protein_g: 42,
    carbs_g: 25,
    fat_g: 28,
    fiber_g: 8,
    micronutrients: { iron: "medio", calcium: "medio", vitamin_c: "alto", potassium: "alto" },
    nutrition_quality: "muy_buena",
    nutrition_quality_score: 90,
    ai_analysis: "Excelente equilibrio: proteína de calidad, grasas saludables (omega-3) y vegetales.",
    ai_recommendation: "Mantén este tipo de comidas; ideal para la cena.",
  },
  {
    meal_name: "Yogur griego con granola",
    meal_type: "snack",
    detected_foods: ["yogur griego", "granola", "miel", "arándanos"],
    portion_estimate: "1 vaso",
    calories: 280,
    protein_g: 18,
    carbs_g: 32,
    fat_g: 8,
    fiber_g: 4,
    micronutrients: { iron: "bajo", calcium: "alto", vitamin_c: "medio", potassium: "medio" },
    nutrition_quality: "buena",
    nutrition_quality_score: 78,
    ai_analysis: "Snack alto en proteína y calcio, buena opción entre comidas.",
    ai_recommendation: "Modera la miel y la granola si buscas reducir azúcares.",
  },
];

/**
 * Analiza la imagen de una comida y estima nutrientes. Mock determinista basado
 * en el contenido de la imagen (tamaño) para que la misma foto dé el mismo
 * resultado dentro del set de ejemplos.
 */
export async function analyzeMeal(image: {
  bytes: number;
  name: string;
  dataUrl?: string | null; // data:<mime>;base64,... — necesario para visión real
}): Promise<MealAnalysis> {
  if (isVisionConfigured() && image.dataUrl) {
    return callRealModelMeal(image);
  }
  await delay(900);
  const idx = (image.bytes + image.name.length) % MOCK_MEALS.length;
  return MOCK_MEALS[idx];
}

// ===========================================================================
//  3) Chat nutricional
// ===========================================================================

export interface ChatContext {
  profile: NutritionProfile | null;
  goal: NutritionGoal | null;
  caloriesConsumed: number;
  caloriesRemaining: number;
}

/** Respuesta del chat. Usa el modelo real si está configurado; si no, mock contextual. */
export async function chatReply(message: string, ctx: ChatContext): Promise<string> {
  if (isAiConfigured()) {
    return callRealModelChat(message, ctx);
  }
  await delay(600);
  return mockChatReply(message, ctx);
}

function mockChatReply(message: string, ctx: ChatContext): string {
  const m = message.toLowerCase();
  const remaining = Math.max(0, Math.round(ctx.caloriesRemaining));
  const proteinGoal = ctx.goal?.daily_protein_g ?? 120;

  let body: string;
  if (m.includes("cena") || m.includes("cenar")) {
    body = `Con unas ${remaining} kcal disponibles, una buena opción de cena sería pollo o pescado a la plancha con verduras al vapor y una porción pequeña de arroz integral. Es liviana, alta en proteína y fácil de digerir.`;
  } else if (m.includes("proteína") || m.includes("proteina")) {
    body = `Para llegar a tu meta de ~${proteinGoal} g de proteína, prioriza pechuga de pollo, huevos, atún, yogur griego o legumbres. Una porción de 150 g de pollo aporta cerca de 35 g de proteína.`;
  } else if (m.includes("antes de entrenar") || m.includes("pre")) {
    body = `Antes de entrenar conviene un carbohidrato de fácil digestión más algo de proteína: un plátano con yogur, o avena con claras, 60–90 min antes. Evita comidas muy grasas justo antes.`;
  } else if (m.includes("mejorar") || m.includes("semana")) {
    body = `Revisando tu semana, enfócate en sumar más vegetales y fibra, mantener la proteína en cada comida y cuidar la hidratación. Pequeños cambios sostenibles funcionan mejor que dietas estrictas.`;
  } else if (m.includes("pollo") || m.includes("arroz") || m.includes("verdura")) {
    body = `Con pollo, arroz y verduras puedes preparar un salteado: dora el pollo en trozos, agrega las verduras y sirve sobre arroz. Aporta proteína, carbohidratos y micronutrientes en un solo plato.`;
  } else {
    body = `Buena pregunta. En general, busca que cada comida tenga una fuente de proteína, vegetales y un carbohidrato de calidad. Si me das más contexto (ingredientes, hora del día, calorías restantes) te doy una sugerencia más concreta.`;
  }

  return body;
}

// ===========================================================================
//  Llamadas al modelo real — endpoint compatible con OpenAI (/chat/completions).
//  Funciona con Ollama (http://localhost:11434/v1), OpenAI, Groq, OpenRouter…
//  Ante error de red/parseo, cada función cae al mock correspondiente.
// ===========================================================================

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | unknown[];
}

/** POST {BASE_URL}/chat/completions y devuelve el texto del primer mensaje. */
async function chatCompletion(
  model: string,
  messages: ChatMessage[],
  opts: { json?: boolean } = {},
): Promise<string> {
  const url = `${BASE_URL!.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  logPrompt(model, messages);

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: 0.4,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    // Modelos locales pueden tardar; deja margen amplio.
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`IA respondió ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respuesta de IA vacía");
  return content;
}

/**
 * Imprime en el servidor el prompt exacto que se enviará a la IA (terminal de
 * `npm run dev`). Trunca el base64 de imágenes para no llenar la consola.
 * Desactiva con AI_DEBUG_PROMPT=0.
 */
function logPrompt(model: string, messages: ChatMessage[]): void {
  if (process.env.AI_DEBUG_PROMPT === "0") return;

  const safe = messages.map((m) => {
    if (typeof m.content === "string") return m;
    const parts = (m.content as Array<Record<string, unknown>>).map((p) => {
      if (p.type === "image_url") {
        const url = (p.image_url as { url?: string })?.url ?? "";
        return { type: "image_url", image_url: `${url.slice(0, 48)}…(${url.length} chars base64)` };
      }
      return p;
    });
    return { role: m.role, content: parts };
  });

  console.log("\n────────── PROMPT → IA ──────────");
  console.log("modelo:", model);
  console.log(JSON.stringify(safe, null, 2));
  console.log("──────────────────────────────────\n");
}

/** Extrae el primer objeto JSON de un texto (los modelos a veces lo envuelven). */
function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvió JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

async function callRealModelGoals(profile: NutritionProfile): Promise<GeneratedGoals> {
  try {
    const content = await chatCompletion(
      MODEL_NAME!,
      [
        {
          role: "system",
          content:
            "Eres un asistente de nutrición. Calcula metas diarias realistas para el perfil dado. " +
            "Responde SOLO con un objeto JSON con EXACTAMENTE estas claves numéricas " +
            "(daily_calories, daily_protein_g, daily_carbs_g, daily_fat_g, daily_fiber_g, " +
            "daily_water_l, daily_vegetable_servings, weekly_calories) y de texto " +
            "(goal_summary, ai_recommendations). No des diagnósticos médicos. No recomiendes dietas extremas.",
        },
        { role: "user", content: JSON.stringify(profile) },
      ],
      { json: true },
    );
    const g = extractJson<Partial<GeneratedGoals>>(content);
    const base = mockGoals(profile); // relleno seguro para claves faltantes
    return { ...base, ...numericClean(g) };
  } catch {
    return mockGoals(profile);
  }
}

/** Convierte campos numéricos de string→number y descarta NaN (modelos a veces devuelven strings). */
function numericClean(g: Partial<GeneratedGoals>): Partial<GeneratedGoals> {
  const out: Record<string, unknown> = { ...g };
  for (const k of [
    "daily_calories", "daily_protein_g", "daily_carbs_g", "daily_fat_g",
    "daily_fiber_g", "daily_water_l", "daily_vegetable_servings", "weekly_calories",
  ]) {
    const n = Number(out[k]);
    if (!Number.isFinite(n)) delete out[k];
    else out[k] = n;
  }
  return out as Partial<GeneratedGoals>;
}

async function callRealModelMeal(image: {
  bytes: number;
  name: string;
  dataUrl?: string | null;
}): Promise<MealAnalysis> {
  try {
    const content = await chatCompletion(
      VISION_MODEL!,
      [
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "Analiza la comida de la imagen. Responde SOLO con un objeto JSON con estas claves: " +
                "meal_name (string), meal_type ('desayuno'|'almuerzo'|'cena'|'snack'), " +
                "detected_foods (array de strings), portion_estimate (string), " +
                "calories, protein_g, carbs_g, fat_g, fiber_g (números), " +
                "micronutrients (objeto de string:nivel), " +
                "nutrition_quality ('muy_baja'|'baja'|'media'|'buena'|'muy_buena'), " +
                "nutrition_quality_score (0-100), ai_analysis (string), ai_recommendation (string). " +
                "Los valores son aproximados.",
            },
            { type: "image_url", image_url: { url: image.dataUrl } },
          ],
        },
      ],
      { json: true },
    );
    const m = extractJson<MealAnalysis>(content);
    // Asegura la coherencia de la etiqueta de calidad con el score si vino.
    if (typeof m.nutrition_quality_score === "number" && !m.nutrition_quality) {
      m.nutrition_quality = qualityFromScore(m.nutrition_quality_score);
    }
    return m;
  } catch {
    const idx = (image.bytes + image.name.length) % MOCK_MEALS.length;
    return MOCK_MEALS[idx];
  }
}

async function callRealModelChat(message: string, ctx: ChatContext): Promise<string> {
  try {
    const context = [
      ctx.profile ? `Perfil: ${JSON.stringify(ctx.profile)}` : "",
      ctx.goal ? `Metas: ${JSON.stringify(ctx.goal)}` : "",
      `Calorías consumidas hoy: ${Math.round(ctx.caloriesConsumed)}.`,
      `Calorías restantes hoy: ${Math.round(ctx.caloriesRemaining)}.`,
    ]
      .filter(Boolean)
      .join("\n");
    return await chatCompletion(MODEL_NAME!, [
      {
        role: "system",
        content:
          "Eres un asistente de nutrición en español. Usa el contexto del usuario. " +
          "Sé breve y práctico. No des diagnósticos médicos ni recomiendes dietas extremas. " +
          "Si mencionan una condición médica, sugiere consultar a un profesional.\n" +
          context,
      },
      { role: "user", content: message },
    ]);
  } catch {
    return mockChatReply(message, ctx);
  }
}

// ---------------------------------------------------------------------------
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Mapea un score 0-100 a la etiqueta de calidad nutricional. */
export function qualityFromScore(score: number): NutritionQuality {
  if (score < 25) return "muy_baja";
  if (score < 45) return "baja";
  if (score < 70) return "media";
  if (score < 85) return "buena";
  return "muy_buena";
}
