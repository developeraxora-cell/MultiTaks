import "server-only";

import { MUSCLE_GROUP_LABELS, muscleGroupLabel } from "./types";
import type {
  GymExercise,
  MuscleGroup,
  RoutineProposal,
  RoutineProposalExercise,
  WorkoutAnalysis,
  WorkoutComparison,
} from "./types";

/**
 * Capa de IA del módulo de gimnasio (Fase 2).
 *
 * Genera el ANÁLISIS NARRATIVO de una sesión a partir de la comparación
 * objetivo (rutina) vs realizado (series reales). Los NÚMEROS los calcula
 * `lib/gym/calc.ts` de forma determinista; la IA solo redacta la prosa
 * (resumen, aciertos, mejoras, foco siguiente).
 *
 * Reusa las mismas variables de entorno que el resto de la app:
 *   AI_MODEL_API_KEY   — clave del proveedor (opcional en Ollama).
 *   AI_MODEL_BASE_URL  — endpoint compatible OpenAI. Ej: http://localhost:11434/v1
 *   AI_MODEL_NAME      — modelo de texto. Ej: llama3.1 / gpt-4o-mini
 *
 * `server-only`: las llamadas SIEMPRE salen del servidor. Ante error de
 * red/parseo cae al MOCK para no romper el flujo.
 */

const API_KEY = process.env.AI_MODEL_API_KEY;
const BASE_URL = process.env.AI_MODEL_BASE_URL;
const MODEL_NAME = process.env.AI_MODEL_NAME;

/** `true` cuando hay endpoint + modelo de texto (la API key es opcional). */
export function isGymAiConfigured(): boolean {
  return Boolean(BASE_URL && MODEL_NAME);
}

export interface WorkoutAnalysisInput {
  routineName: string | null;
  durationMinutes: number | null;
  overallEffort: number | null;
  comparison: WorkoutComparison;
}

/**
 * Genera el análisis de una sesión. Usa el modelo real si está configurado;
 * si no, devuelve un mock determinista a partir de la comparación.
 */
export async function analyzeWorkout(
  input: WorkoutAnalysisInput,
): Promise<WorkoutAnalysis> {
  if (isGymAiConfigured()) {
    return callRealModel(input);
  }
  await delay(500);
  return mockAnalysis(input);
}

// ===========================================================================
//  Mock determinista — deriva la narrativa de los números de la comparación.
// ===========================================================================

function mockAnalysis(input: WorkoutAnalysisInput): WorkoutAnalysis {
  const { comparison: c } = input;
  const well: string[] = [];
  const improve: string[] = [];

  const planned = c.exercises.filter((e) => e.status !== "sin_objetivo");
  const cumplidos = planned.filter((e) => e.status === "cumplido" || e.status === "superado");
  const parciales = planned.filter((e) => e.status === "parcial");
  const superados = planned.filter((e) => e.status === "superado");

  // Aciertos.
  if (superados.length) {
    well.push(
      `Superaste el objetivo en ${superados
        .map((e) => e.exercise_name)
        .slice(0, 3)
        .join(", ")}.`,
    );
  }
  if (cumplidos.length) {
    well.push(`Cumpliste el objetivo en ${cumplidos.length} de ${planned.length} ejercicios.`);
  }
  if (c.completed_exercises === c.total_exercises && c.total_exercises > 0) {
    well.push("Completaste todos los ejercicios de la sesión.");
  }
  if (input.overallEffort != null && input.overallEffort >= 7) {
    well.push(`Buen nivel de esfuerzo percibido (${input.overallEffort}/10).`);
  }
  if (well.length === 0) {
    well.push("Registraste tu sesión: el primer paso para progresar es medir.");
  }

  // Mejoras.
  for (const e of parciales.slice(0, 3)) {
    const detail =
      e.adherence_pct != null
        ? ` (${e.adherence_pct}% del volumen objetivo)`
        : "";
    improve.push(`En ${e.exercise_name} quedaste por debajo del objetivo${detail}.`);
  }
  if (c.overall_adherence_pct != null && c.overall_adherence_pct < 90) {
    improve.push(
      `Adherencia global del ${c.overall_adherence_pct}%: ajusta peso o repeticiones para acercarte al plan.`,
    );
  }
  if (improve.length === 0) {
    improve.push("Mantén la progresión: sube peso o reps de forma gradual la próxima vez.");
  }

  // Foco siguiente.
  let nextFocus: string;
  if (superados.length) {
    nextFocus = `Sube ligeramente el peso en ${superados[0].exercise_name} para seguir progresando.`;
  } else if (parciales.length) {
    const muscles = [...new Set(parciales.map((e) => muscleGroupLabel(e.muscle_group)))]
      .filter((m) => m !== "—")
      .slice(0, 2)
      .join(" y ");
    nextFocus = muscles
      ? `Refuerza ${muscles}: prioriza completar las series objetivo antes de subir carga.`
      : "Enfócate en completar todas las series objetivo antes de aumentar la carga.";
  } else {
    nextFocus = "Aplica sobrecarga progresiva: +2.5 kg o +1-2 reps respecto a esta sesión.";
  }

  const adher =
    c.overall_adherence_pct != null ? `${c.overall_adherence_pct}% del objetivo` : "sin objetivo comparable";
  const summary =
    `Sesión${input.routineName ? ` de "${input.routineName}"` : " libre"} con ` +
    `${Math.round(c.actual_volume)} kg de volumen total (${adher}). ` +
    `Completaste ${c.completed_exercises}/${c.total_exercises} ejercicios.`;

  return { summary, what_went_well: well, to_improve: improve, next_focus: nextFocus };
}

// ===========================================================================
//  Modelo real — endpoint compatible con OpenAI (/chat/completions).
// ===========================================================================

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

async function chatCompletion(model: string, messages: ChatMessage[]): Promise<string> {
  const url = `${BASE_URL!.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`IA respondió ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respuesta de IA vacía");
  return content;
}

function extractJson<T>(text: string): T {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("La IA no devolvió JSON");
  return JSON.parse(text.slice(start, end + 1)) as T;
}

/** Resumen compacto de la comparación para alimentar al modelo (números exactos). */
function comparisonForPrompt(input: WorkoutAnalysisInput) {
  return {
    rutina: input.routineName,
    duracion_min: input.durationMinutes,
    esfuerzo_general: input.overallEffort,
    volumen_objetivo: input.comparison.planned_volume,
    volumen_real: Math.round(input.comparison.actual_volume),
    adherencia_pct: input.comparison.overall_adherence_pct,
    ejercicios: input.comparison.exercises.map((e) => ({
      ejercicio: e.exercise_name,
      grupo: muscleGroupLabel(e.muscle_group),
      series_objetivo: e.target_sets,
      series_hechas: e.done_sets,
      reps_objetivo: e.target_reps,
      reps_promedio: e.avg_actual_reps,
      peso_objetivo: e.target_weight,
      peso_promedio: e.avg_actual_weight,
      adherencia_pct: e.adherence_pct,
      estado: e.status,
    })),
  };
}

async function callRealModel(input: WorkoutAnalysisInput): Promise<WorkoutAnalysis> {
  try {
    const content = await chatCompletion(MODEL_NAME!, [
      {
        role: "system",
        content:
          "Eres un entrenador de gimnasio en español. Analiza la sesión comparando el " +
          "objetivo planificado con lo realmente realizado. Usa SOLO los números dados; " +
          "no inventes datos. Sé breve, práctico y motivador. No critiques el cuerpo del " +
          "usuario. No des diagnósticos médicos ni recomendaciones extremas. " +
          "Responde SOLO con un objeto JSON con estas claves: " +
          "summary (string), what_went_well (array de strings), to_improve (array de strings), " +
          "next_focus (string).",
      },
      { role: "user", content: JSON.stringify(comparisonForPrompt(input)) },
    ]);
    const parsed = extractJson<Partial<WorkoutAnalysis>>(content);
    const base = mockAnalysis(input);
    return {
      summary: typeof parsed.summary === "string" ? parsed.summary : base.summary,
      what_went_well: cleanList(parsed.what_went_well) ?? base.what_went_well,
      to_improve: cleanList(parsed.to_improve) ?? base.to_improve,
      next_focus: typeof parsed.next_focus === "string" ? parsed.next_focus : base.next_focus,
    };
  } catch {
    return mockAnalysis(input);
  }
}

function cleanList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out = v.map(String).map((s) => s.trim()).filter(Boolean);
  return out.length ? out : null;
}

// ===========================================================================
//  Chat — Coach IA del gimnasio
// ===========================================================================

export interface GymChatContext {
  // --- Perfil de la persona ---
  goalMain: string | null; // objetivo (de su perfil fitness/nutrición)
  sex: string | null;
  age: number | null;
  weightKg: number | null;
  heightCm: number | null;
  activityLevel: string | null;
  restrictions: string | null; // alergias / restricciones / notas de salud
  // --- Nutrición ---
  dailyCaloriesGoal: number | null;
  proteinGoal: number | null;
  caloriesToday: number | null;
  // --- Hábitos ---
  activeHabits: number;
  weekHabitPct: number | null; // % cumplimiento de hábitos esta semana
  // --- Gimnasio ---
  routineNames: string[];
  totalSessions: number;
  sessionsThisWeek: number;
  lastSessionSummary: string | null;
}

/** Construye el bloque de contexto (texto compacto) que conoce el coach. */
function contextLines(ctx: GymChatContext): string {
  const perfil: string[] = [];
  if (ctx.goalMain) perfil.push(`objetivo: ${ctx.goalMain}`);
  if (ctx.sex) perfil.push(ctx.sex);
  if (ctx.age != null) perfil.push(`${ctx.age} años`);
  if (ctx.weightKg != null) perfil.push(`${ctx.weightKg} kg`);
  if (ctx.heightCm != null) perfil.push(`${ctx.heightCm} cm`);
  if (ctx.activityLevel) perfil.push(`actividad ${ctx.activityLevel}`);

  const nutri: string[] = [];
  if (ctx.dailyCaloriesGoal != null) nutri.push(`meta ${ctx.dailyCaloriesGoal} kcal/día`);
  if (ctx.proteinGoal != null) nutri.push(`${ctx.proteinGoal} g proteína/día`);
  if (ctx.caloriesToday != null) nutri.push(`hoy lleva ${ctx.caloriesToday} kcal`);

  return [
    perfil.length ? `Perfil: ${perfil.join(", ")}.` : "",
    ctx.restrictions ? `Salud/restricciones: ${ctx.restrictions}.` : "",
    nutri.length ? `Nutrición: ${nutri.join(", ")}.` : "",
    `Hábitos: ${ctx.activeHabits} activos${
      ctx.weekHabitPct != null ? `, cumplimiento semanal ${ctx.weekHabitPct}%` : ""
    }.`,
    `Gimnasio: ${ctx.totalSessions} sesiones totales, ${ctx.sessionsThisWeek} esta semana${
      ctx.routineNames.length ? `; rutinas: ${ctx.routineNames.slice(0, 5).join(", ")}` : ""
    }.`,
    ctx.lastSessionSummary ? `Última sesión: ${ctx.lastSessionSummary}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** Respuesta del coach. Modelo real si configurado; si no, mock contextual. */
export async function gymChatReply(message: string, ctx: GymChatContext): Promise<string> {
  if (isGymAiConfigured()) {
    return callRealModelChat(message, ctx);
  }
  await delay(600);
  return mockChatReply(message, ctx);
}

/** Saludo corto que personaliza con el dato más relevante disponible. */
function personalTag(ctx: GymChatContext): string {
  if (ctx.goalMain) return `Para tu objetivo (${ctx.goalMain}), `;
  if (ctx.sessionsThisWeek === 0 && ctx.totalSessions > 0) return "Llevas la semana sin entrenar; ";
  return "";
}

function mockChatReply(message: string, ctx: GymChatContext): string {
  const m = message.toLowerCase();
  const tag = personalTag(ctx);

  if (m.includes("pecho") || m.includes("press")) {
    return `${tag}prioriza press de banca con sobrecarga progresiva (+2.5 kg al completar las series). Suma press inclinado y aperturas. Baja 2-3 s, omóplatos retraídos.`;
  }
  if (m.includes("espalda") || m.includes("dominada")) {
    return `${tag}combina tracción vertical (dominada/jalón) + horizontal (remo). Codos hacia atrás-abajo, sin balanceo. 3-4 series de 8-12.`;
  }
  if (m.includes("pierna") || m.includes("sentadilla")) {
    return `${tag}base: sentadilla y peso muerto, más prensa y curl femoral. Cuida profundidad y técnica antes de subir carga. 2-3x/semana.`;
  }
  if (m.includes("proteína") || m.includes("proteina")) {
    const meta = ctx.proteinGoal ? `~${ctx.proteinGoal} g/día` : "1.6-2 g por kg";
    return `${tag}apunta a ${meta}. Reparte en cada comida: pollo, huevo, atún, yogur griego o legumbres. Clave para recuperar y ganar músculo.`;
  }
  if (m.includes("descanso") || m.includes("recuper")) {
    return `${tag}48-72 h por grupo antes de volver a cargarlo fuerte. Entre series: 1.5-3 min (fuerza), 60-90 s (accesorios). Duerme bien.`;
  }
  if (m.includes("progres") || m.includes("estanc")) {
    const tip = ctx.lastSessionSummary ? ` Tu última sesión: ${ctx.lastSessionSummary}` : "";
    return `${tag}rompe el estancamiento variando reps, sumando una serie o mejorando técnica/tempo. Sobrecarga progresiva manda.${tip}`;
  }

  return `${tag}dime tu objetivo y qué grupo quieres trabajar y te doy algo concreto. Técnica primero, carga después.`;
}

async function callRealModelChat(message: string, ctx: GymChatContext): Promise<string> {
  try {
    return await chatCompletionText(MODEL_NAME!, [
      {
        role: "system",
        content:
          "Eres el coach personal de gimnasio de esta persona, en español. CONOCES su perfil, " +
          "nutrición, hábitos e historial (abajo) y debes personalizar SIEMPRE con esos datos.\n\n" +
          "Estilo OBLIGATORIO: respuesta CORTA y precisa, máximo ~90 palabras. Ve al grano, sin " +
          "relleno ni introducciones largas. Usa frases directas; lista breve solo si aporta. " +
          "Tono de coach cercano y motivador. Da 1-3 acciones concretas, no un ensayo.\n" +
          "Seguridad: no critiques el cuerpo del usuario, no des diagnósticos médicos ni dietas " +
          "extremas o sustancias; si menciona dolor/lesión, sugiere ver a un profesional.\n\n" +
          "=== Datos de la persona ===\n" +
          contextLines(ctx),
      },
      { role: "user", content: message },
    ]);
  } catch {
    return mockChatReply(message, ctx);
  }
}

/** Igual que chatCompletion pero sin forzar response_format JSON (respuesta libre). */
async function chatCompletionText(model: string, messages: ChatMessage[]): Promise<string> {
  const url = `${BASE_URL!.replace(/\/$/, "")}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers.Authorization = `Bearer ${API_KEY}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages, stream: false, temperature: 0.6 }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`IA respondió ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Respuesta de IA vacía");
  return content;
}

// ===========================================================================
//  Propuesta de rutina — el coach arma una rutina lista para crear
// ===========================================================================

/** `true` si el mensaje pide armar/crear una rutina. */
export function looksLikeRoutineRequest(message: string): boolean {
  const m = normalize(message);
  return (
    /(arma|crea|haz|hazme|genera|generame|dame|necesito|quiero|prepara|disena)/.test(m) &&
    /(rutina|entrenamiento|workout|plan)/.test(m)
  ) || /rutina de|rutina para|entrenamiento de/.test(m);
}

/**
 * Construye una propuesta de rutina a partir del mensaje y el catálogo del
 * usuario. Empareja los ejercicios con el catálogo (exercise_id) para que se
 * puedan crear directamente. Devuelve null si no se puede proponer nada.
 */
export async function proposeRoutine(
  message: string,
  catalog: GymExercise[],
): Promise<RoutineProposal | null> {
  if (isGymAiConfigured()) {
    const real = await callRealModelProposal(message, catalog);
    if (real && real.exercises.length) return real;
  }
  return mockProposal(message, catalog);
}

// Palabras clave → grupo muscular, para el mock y como respaldo.
const MUSCLE_KEYWORDS: Record<MuscleGroup, string[]> = {
  pecho: ["pecho", "pectoral", "press", "empuje"],
  espalda: ["espalda", "dorsal", "remo", "dominada", "jalon", "tiron"],
  hombros: ["hombro", "deltoide", "militar"],
  biceps: ["biceps", "curl"],
  triceps: ["triceps", "frances", "fondos"],
  abdomen: ["abdomen", "abdominal", "core", "plancha"],
  piernas: ["pierna", "cuadriceps", "femoral", "sentadilla", "tren inferior"],
  gluteos: ["gluteo", "hip thrust", "cadera"],
  cuerpo_completo: ["cuerpo completo", "full body", "fullbody", "general"],
  cardio: ["cardio", "correr", "resistencia", "hiit"],
};

function detectMuscleGroups(message: string): MuscleGroup[] {
  const m = normalize(message);
  const found: MuscleGroup[] = [];
  for (const [group, words] of Object.entries(MUSCLE_KEYWORDS) as [MuscleGroup, string[]][]) {
    if (words.some((w) => m.includes(w))) found.push(group);
  }
  return found;
}

function mockProposal(message: string, catalog: GymExercise[]): RoutineProposal | null {
  let groups = detectMuscleGroups(message);
  if (groups.length === 0) groups = ["cuerpo_completo", "pecho", "espalda", "piernas"];

  const picked: RoutineProposalExercise[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    const candidates = catalog.filter(
      (e) => e.primary_muscle_group === g && !seen.has(e.id),
    );
    // 2 ejercicios por grupo como máximo.
    for (const e of candidates.slice(0, 2)) {
      seen.add(e.id);
      picked.push(proposalExerciseFromCatalog(e));
    }
    if (picked.length >= 6) break;
  }
  if (picked.length === 0) return null;

  const label = groups
    .slice(0, 2)
    .map((g) => MUSCLE_GROUP_LABELS[g])
    .join(" y ");

  return {
    name: `Rutina de ${label}`,
    objective: "Hipertrofia",
    difficulty_level: "intermedio",
    exercises: picked,
  };
}

function proposalExerciseFromCatalog(e: GymExercise): RoutineProposalExercise {
  const cardio = e.primary_muscle_group === "cardio";
  return {
    exercise_id: e.id,
    name: e.name,
    muscle_group: e.primary_muscle_group,
    target_sets: cardio ? 1 : 4,
    target_reps: cardio ? null : 10,
    target_weight: null,
    rest_seconds: cardio ? null : 90,
  };
}

/** Normaliza para matching: minúsculas + sin acentos. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Empareja un nombre de ejercicio (de la IA) con el catálogo. */
function matchExercise(name: string, catalog: GymExercise[]): GymExercise | null {
  const n = normalize(name);
  let best = catalog.find((e) => normalize(e.name) === n);
  if (best) return best;
  best = catalog.find((e) => normalize(e.name).includes(n) || n.includes(normalize(e.name)));
  return best ?? null;
}

interface RawProposalExercise {
  name?: string;
  sets?: number | string;
  reps?: number | string;
  weight?: number | string;
  rest_seconds?: number | string;
}
interface RawProposal {
  name?: string;
  objective?: string;
  difficulty?: string;
  exercises?: RawProposalExercise[];
}

async function callRealModelProposal(
  message: string,
  catalog: GymExercise[],
): Promise<RoutineProposal | null> {
  try {
    const names = catalog.map((e) => e.name).join(", ");
    const content = await chatCompletion(MODEL_NAME!, [
      {
        role: "system",
        content:
          "Eres un coach de gimnasio. Arma una rutina según la petición del usuario. " +
          "USA SOLO ejercicios de esta lista (cópialos con el mismo nombre): " +
          names +
          ". Responde SOLO con un objeto JSON: { name (string), objective (string), " +
          "difficulty ('principiante'|'intermedio'|'avanzado'), exercises: array de " +
          "{ name (string, de la lista), sets (number), reps (number), rest_seconds (number) } }. " +
          "Entre 4 y 7 ejercicios. No incluyas texto fuera del JSON.",
      },
      { role: "user", content: message },
    ]);
    const raw = extractJson<RawProposal>(content);
    const exercises: RoutineProposalExercise[] = [];
    for (const re of raw.exercises ?? []) {
      if (!re.name) continue;
      const match = matchExercise(re.name, catalog);
      if (!match) continue; // solo ejercicios reales del catálogo
      exercises.push({
        exercise_id: match.id,
        name: match.name,
        muscle_group: match.primary_muscle_group,
        target_sets: Number(re.sets) > 0 ? Number(re.sets) : 4,
        target_reps: Number(re.reps) > 0 ? Number(re.reps) : 10,
        target_weight: null,
        rest_seconds: Number(re.rest_seconds) > 0 ? Number(re.rest_seconds) : 90,
      });
    }
    if (exercises.length === 0) return null;
    return {
      name: typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : "Rutina sugerida",
      objective: typeof raw.objective === "string" ? raw.objective : null,
      difficulty_level: typeof raw.difficulty === "string" ? raw.difficulty : null,
      exercises,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
