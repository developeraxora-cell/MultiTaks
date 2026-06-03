"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSupabase } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { todayKey } from "@/lib/date";
import {
  getExercise,
  getRoutineWithExercises,
  getSessionWithLogs,
  listExercisesForUser,
} from "@/lib/queries/gym";
import {
  deleteCloudinaryImage,
  uploadExerciseImageToCloudinary,
} from "@/lib/cloudinary/server";
import { compareWorkout } from "@/lib/gym/calc";
import {
  analyzeWorkout,
  gymChatReply,
  isGymAiConfigured,
  looksLikeRoutineRequest,
  proposeRoutine,
  type GymChatContext,
} from "@/lib/gym/ai";
import {
  MUSCLE_GROUPS,
  type MuscleGroup,
  type RoutineProposal,
} from "@/lib/gym/types";
import {
  getActiveNutritionGoal,
  getDailySummary,
  getNutritionProfileByUserId,
} from "@/lib/queries/nutrition";
import { listActiveTasks } from "@/lib/queries/tasks";
import { reportOverall } from "@/lib/reports/calc";
import { weekRange } from "@/lib/date";
import {
  ACTIVITY_LEVEL_LABELS,
  MAIN_GOAL_LABELS,
  SEX_LABELS,
  type ActivityLevel,
  type MainGoal,
  type Sex,
} from "@/lib/nutrition/types";

// ---------------------------------------------------------------------------
//  Helpers de parseo de FormData
// ---------------------------------------------------------------------------
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
function boolFrom(v: FormDataEntryValue | null): boolean {
  const s = str(v).toLowerCase();
  return s === "true" || s === "on" || s === "1";
}

function revalidateModule() {
  revalidatePath("/gimnasio");
  revalidatePath("/gimnasio/rutinas");
  revalidatePath("/gimnasio/ejercicios");
  revalidatePath("/gimnasio/historial");
}

// ---------------------------------------------------------------------------
//  Validación de pertenencia (service_role salta RLS → validamos en la app)
// ---------------------------------------------------------------------------

/** Devuelve el user_id dueño de una sesión, o null. */
async function sessionOwner(sessionId: string): Promise<string | null> {
  const { data } = await getSupabase()
    .from("gym_workout_sessions")
    .select("user_id")
    .eq("id", sessionId)
    .maybeSingle();
  return (data as { user_id: string } | null)?.user_id ?? null;
}

/** Verifica que la sesión es del usuario; lanza si no. */
async function assertSessionOwner(sessionId: string, userId: string): Promise<void> {
  if ((await sessionOwner(sessionId)) !== userId) {
    throw new Error("Sesión no encontrada");
  }
}

/** Devuelve {sessionId} del exercise_log si pertenece al usuario, o lanza. */
async function assertExerciseLogOwner(
  exerciseLogId: string,
  userId: string,
): Promise<string> {
  const { data } = await getSupabase()
    .from("gym_workout_exercise_logs")
    .select("workout_session_id, gym_workout_sessions(user_id)")
    .eq("id", exerciseLogId)
    .maybeSingle();
  const row = data as
    | { workout_session_id: string; gym_workout_sessions: { user_id: string } | null }
    | null;
  if (!row || row.gym_workout_sessions?.user_id !== userId) {
    throw new Error("Registro no encontrado");
  }
  return row.workout_session_id;
}

// ===========================================================================
//  Catálogo de ejercicios (personalizados del usuario)
// ===========================================================================

/**
 * Sube la imagen del ejercicio a Cloudinary si viene un archivo en el FormData
 * (campo `image`). Devuelve null si no hay archivo. Lanza si Cloudinary falla.
 */
async function uploadExerciseImage(
  fd: FormData,
  userId: string,
): Promise<{ url: string; path: string } | null> {
  const file = fd.get("image");
  if (!(file instanceof File) || file.size === 0) return null;
  const mime = file.type || "image/jpeg";
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadExerciseImageToCloudinary({
    buffer,
    mime,
    userId,
    fileName: file.name || "exercise",
  });
  return { url: uploaded.url, path: uploaded.publicId };
}

export async function createExercise(fd: FormData): Promise<void> {
  const session = await requireUser();
  const name = str(fd.get("name"));
  if (!name) throw new Error("El nombre del ejercicio es obligatorio");

  const primary = str(fd.get("primary_muscle_group"));
  if (!MUSCLE_GROUPS.includes(primary as MuscleGroup)) {
    throw new Error("Grupo muscular inválido");
  }

  const img = await uploadExerciseImage(fd, session.userId);

  const { error } = await getSupabase().from("gym_exercises").insert({
    name,
    description: strOrNull(fd.get("description")),
    primary_muscle_group: primary,
    equipment: strOrNull(fd.get("equipment")),
    exercise_type: strOrNull(fd.get("exercise_type")),
    image_url: img?.url ?? null,
    image_path: img?.path ?? null,
    instructions: strOrNull(fd.get("instructions")),
    is_global: false,
    user_id: session.userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/gimnasio/ejercicios");
}

export async function updateExercise(fd: FormData): Promise<void> {
  const session = await requireUser();
  const id = str(fd.get("id"));
  if (!id) throw new Error("Falta el id del ejercicio");

  const primary = str(fd.get("primary_muscle_group"));
  if (!MUSCLE_GROUPS.includes(primary as MuscleGroup)) {
    throw new Error("Grupo muscular inválido");
  }

  // Verifica pertenencia y obtén la imagen actual (para reemplazarla si hay nueva).
  const existing = await getExercise(id);
  if (!existing || existing.user_id !== session.userId || existing.is_global) {
    throw new Error("Ejercicio no encontrado");
  }

  const img = await uploadExerciseImage(fd, session.userId);

  const update: Record<string, unknown> = {
    name: str(fd.get("name")),
    description: strOrNull(fd.get("description")),
    primary_muscle_group: primary,
    equipment: strOrNull(fd.get("equipment")),
    exercise_type: strOrNull(fd.get("exercise_type")),
    instructions: strOrNull(fd.get("instructions")),
  };
  if (img) {
    update.image_url = img.url;
    update.image_path = img.path;
  }

  const { error } = await getSupabase()
    .from("gym_exercises")
    .update(update)
    .eq("id", id)
    .eq("user_id", session.userId)
    .eq("is_global", false);
  if (error) throw new Error(error.message);

  // Borra la imagen anterior de Cloudinary si fue reemplazada.
  if (img && existing.image_path && existing.image_path !== img.path) {
    await deleteCloudinaryImage(existing.image_path);
  }
  revalidatePath("/gimnasio/ejercicios");
}

/** Soft delete de un ejercicio personalizado (conserva historial). */
export async function deleteExercise(id: string): Promise<void> {
  const session = await requireUser();
  const { error } = await getSupabase()
    .from("gym_exercises")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.userId)
    .eq("is_global", false);
  if (error) throw new Error(error.message);
  revalidatePath("/gimnasio/ejercicios");
}

// ===========================================================================
//  Rutinas + ejercicios planificados
// ===========================================================================

/** Forma de un ejercicio planificado tal como llega del formulario (JSON). */
interface RoutineExerciseInput {
  exercise_id: string;
  target_sets?: number | null;
  target_reps?: number | null;
  target_reps_min?: number | null;
  target_reps_max?: number | null;
  target_weight?: number | null;
  target_weight_unit?: string | null;
  rest_seconds?: number | null;
  notes?: string | null;
}

function parseRoutineExercises(fd: FormData): RoutineExerciseInput[] {
  const raw = str(fd.get("exercises"));
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e): e is RoutineExerciseInput => Boolean(e && (e as RoutineExerciseInput).exercise_id))
    .map((e) => ({
      exercise_id: String(e.exercise_id),
      target_sets: e.target_sets != null ? Number(e.target_sets) : 3,
      target_reps: e.target_reps != null ? Number(e.target_reps) : null,
      target_reps_min: e.target_reps_min != null ? Number(e.target_reps_min) : null,
      target_reps_max: e.target_reps_max != null ? Number(e.target_reps_max) : null,
      target_weight: e.target_weight != null ? Number(e.target_weight) : null,
      target_weight_unit: e.target_weight_unit ?? "kg",
      rest_seconds: e.rest_seconds != null ? Number(e.rest_seconds) : null,
      notes: e.notes ? String(e.notes) : null,
    }));
}

/** Inserta las filas de gym_routine_exercises para una rutina, en orden. */
async function insertRoutineExercises(
  routineId: string,
  items: RoutineExerciseInput[],
): Promise<void> {
  if (items.length === 0) return;
  const rows = items.map((e, i) => ({
    routine_id: routineId,
    exercise_id: e.exercise_id,
    order_index: i,
    target_sets: e.target_sets ?? 3,
    target_reps: e.target_reps ?? null,
    target_reps_min: e.target_reps_min ?? null,
    target_reps_max: e.target_reps_max ?? null,
    target_weight: e.target_weight ?? null,
    target_weight_unit: e.target_weight_unit ?? "kg",
    rest_seconds: e.rest_seconds ?? null,
    notes: e.notes ?? null,
  }));
  const { error } = await getSupabase().from("gym_routine_exercises").insert(rows);
  if (error) throw new Error(error.message);
}

/** Crea una rutina con sus ejercicios. Redirige al detalle. */
export async function createRoutine(fd: FormData): Promise<void> {
  const session = await requireUser();
  const name = str(fd.get("name"));
  if (!name) throw new Error("El nombre de la rutina es obligatorio");

  const { data, error } = await getSupabase()
    .from("gym_routines")
    .insert({
      user_id: session.userId,
      created_by: session.userId,
      name,
      description: strOrNull(fd.get("description")),
      objective: strOrNull(fd.get("objective")),
      difficulty_level: strOrNull(fd.get("difficulty_level")),
      estimated_duration_minutes: numOrNull(fd.get("estimated_duration_minutes")),
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const routineId = (data as { id: string }).id;
  await insertRoutineExercises(routineId, parseRoutineExercises(fd));

  revalidateModule();
  redirect(`/gimnasio/rutinas/${routineId}`);
}

/**
 * Edita una rutina y reemplaza por completo sus ejercicios planificados.
 * Nota: esto solo afecta a la rutina (objetivo); NO toca sesiones ya realizadas,
 * que conservan su propia copia de los valores objetivo.
 */
export async function updateRoutine(fd: FormData): Promise<void> {
  const session = await requireUser();
  const id = str(fd.get("id"));
  if (!id) throw new Error("Falta el id de la rutina");
  const name = str(fd.get("name"));
  if (!name) throw new Error("El nombre de la rutina es obligatorio");

  const sb = getSupabase();
  const { error } = await sb
    .from("gym_routines")
    .update({
      name,
      description: strOrNull(fd.get("description")),
      objective: strOrNull(fd.get("objective")),
      difficulty_level: strOrNull(fd.get("difficulty_level")),
      estimated_duration_minutes: numOrNull(fd.get("estimated_duration_minutes")),
    })
    .eq("id", id)
    .eq("user_id", session.userId);
  if (error) throw new Error(error.message);

  // Reemplaza el set de ejercicios planificados.
  await sb.from("gym_routine_exercises").delete().eq("routine_id", id);
  await insertRoutineExercises(id, parseRoutineExercises(fd));

  revalidateModule();
  redirect(`/gimnasio/rutinas/${id}`);
}

/** Activa/desactiva una rutina (no la borra). */
export async function toggleRoutineActive(id: string, isActive: boolean): Promise<void> {
  const session = await requireUser();
  const { error } = await getSupabase()
    .from("gym_routines")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", session.userId);
  if (error) throw new Error(error.message);
  revalidateModule();
}

/** Soft delete de una rutina (conserva el historial de sesiones). */
export async function deleteRoutine(id: string): Promise<void> {
  const session = await requireUser();
  const { error } = await getSupabase()
    .from("gym_routines")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .eq("user_id", session.userId);
  if (error) throw new Error(error.message);
  revalidateModule();
}

// ===========================================================================
//  Sesiones de entrenamiento (lo realizado)
// ===========================================================================

/**
 * Inicia una sesión desde una rutina: crea la sesión in_progress, copia los
 * ejercicios planificados a gym_workout_exercise_logs y pre-crea las series
 * objetivo en gym_workout_set_logs (prellenadas con los valores objetivo).
 * Redirige a la pantalla de entrenamiento.
 */
export async function startWorkoutFromRoutine(routineId: string): Promise<void> {
  const session = await requireUser();
  const routine = await getRoutineWithExercises(routineId, session.userId);
  if (!routine) throw new Error("Rutina no encontrada");

  const sb = getSupabase();
  const nowIso = new Date().toISOString();

  const { data: sData, error: sErr } = await sb
    .from("gym_workout_sessions")
    .insert({
      user_id: session.userId,
      routine_id: routine.id,
      routine_name: routine.name,
      session_date: todayKey(session.timeZone),
      started_at: nowIso,
      status: "in_progress",
    })
    .select("id")
    .single();
  if (sErr) throw new Error(sErr.message);
  const sessionId = (sData as { id: string }).id;

  // Copia cada ejercicio planificado a un log y crea sus series objetivo.
  for (const re of routine.exercises) {
    const { data: logData, error: logErr } = await sb
      .from("gym_workout_exercise_logs")
      .insert({
        workout_session_id: sessionId,
        exercise_id: re.exercise_id,
        routine_exercise_id: re.id,
        exercise_name: re.exercise?.name ?? null,
        order_index: re.order_index,
        target_sets: re.target_sets,
        target_reps: re.target_reps ?? re.target_reps_max ?? re.target_reps_min,
        target_weight: re.target_weight,
        rest_seconds: re.rest_seconds,
      })
      .select("id")
      .single();
    if (logErr) throw new Error(logErr.message);
    const logId = (logData as { id: string }).id;

    const targetReps = re.target_reps ?? re.target_reps_max ?? re.target_reps_min ?? null;
    const sets = Math.max(1, re.target_sets || 1);
    const setRows = Array.from({ length: sets }, (_, i) => ({
      workout_exercise_log_id: logId,
      set_number: i + 1,
      target_reps: targetReps,
      actual_reps: targetReps,
      target_weight: re.target_weight,
      actual_weight: re.target_weight,
      weight_unit: re.target_weight_unit || "kg",
      completed: false,
    }));
    const { error: setErr } = await sb.from("gym_workout_set_logs").insert(setRows);
    if (setErr) throw new Error(setErr.message);
  }

  revalidateModule();
  redirect(`/gimnasio/entrenar/${sessionId}`);
}

/** Inicia una sesión libre (sin rutina). El usuario añade ejercicios manualmente. */
export async function startFreeWorkout(): Promise<void> {
  const session = await requireUser();
  const { data, error } = await getSupabase()
    .from("gym_workout_sessions")
    .insert({
      user_id: session.userId,
      session_date: todayKey(session.timeZone),
      started_at: new Date().toISOString(),
      status: "in_progress",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidateModule();
  redirect(`/gimnasio/entrenar/${(data as { id: string }).id}`);
}

/** Añade un ejercicio del catálogo a una sesión en curso (con N series vacías). */
export async function addExerciseToSession(
  sessionId: string,
  exerciseId: string,
  sets = 3,
): Promise<void> {
  const session = await requireUser();
  await assertSessionOwner(sessionId, session.userId);
  const sb = getSupabase();

  const { data: ex } = await sb
    .from("gym_exercises")
    .select("name")
    .eq("id", exerciseId)
    .maybeSingle();

  const { count } = await sb
    .from("gym_workout_exercise_logs")
    .select("id", { count: "exact", head: true })
    .eq("workout_session_id", sessionId);

  const { data: logData, error: logErr } = await sb
    .from("gym_workout_exercise_logs")
    .insert({
      workout_session_id: sessionId,
      exercise_id: exerciseId,
      exercise_name: (ex as { name: string } | null)?.name ?? null,
      order_index: count ?? 0,
      target_sets: sets,
    })
    .select("id")
    .single();
  if (logErr) throw new Error(logErr.message);
  const logId = (logData as { id: string }).id;

  const n = Math.max(1, sets);
  const rows = Array.from({ length: n }, (_, i) => ({
    workout_exercise_log_id: logId,
    set_number: i + 1,
    completed: false,
  }));
  const { error } = await sb.from("gym_workout_set_logs").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath(`/gimnasio/entrenar/${sessionId}`);
}

/** Quita un ejercicio (y sus series) de una sesión en curso. */
export async function removeExerciseFromSession(exerciseLogId: string): Promise<void> {
  const session = await requireUser();
  const sessionId = await assertExerciseLogOwner(exerciseLogId, session.userId);
  const { error } = await getSupabase()
    .from("gym_workout_exercise_logs")
    .delete()
    .eq("id", exerciseLogId);
  if (error) throw new Error(error.message);
  revalidatePath(`/gimnasio/entrenar/${sessionId}`);
}

/** Marca/desmarca un ejercicio como completado dentro de la sesión. */
export async function toggleExerciseLogComplete(
  exerciseLogId: string,
  completed: boolean,
): Promise<void> {
  const session = await requireUser();
  const sessionId = await assertExerciseLogOwner(exerciseLogId, session.userId);
  const { error } = await getSupabase()
    .from("gym_workout_exercise_logs")
    .update({ is_completed: completed })
    .eq("id", exerciseLogId);
  if (error) throw new Error(error.message);
  revalidatePath(`/gimnasio/entrenar/${sessionId}`);
}

/** Añade una serie vacía a un ejercicio de la sesión. */
export async function addSet(exerciseLogId: string): Promise<void> {
  const session = await requireUser();
  const sessionId = await assertExerciseLogOwner(exerciseLogId, session.userId);
  const sb = getSupabase();

  const { data: last } = await sb
    .from("gym_workout_set_logs")
    .select("set_number, target_reps, target_weight, weight_unit")
    .eq("workout_exercise_log_id", exerciseLogId)
    .order("set_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const prev = last as
    | { set_number: number; target_reps: number | null; target_weight: number | null; weight_unit: string }
    | null;

  const { error } = await sb.from("gym_workout_set_logs").insert({
    workout_exercise_log_id: exerciseLogId,
    set_number: (prev?.set_number ?? 0) + 1,
    target_reps: prev?.target_reps ?? null,
    actual_reps: prev?.target_reps ?? null,
    target_weight: prev?.target_weight ?? null,
    actual_weight: prev?.target_weight ?? null,
    weight_unit: prev?.weight_unit ?? "kg",
    completed: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/gimnasio/entrenar/${sessionId}`);
}

/**
 * Guarda los datos reales de una serie. Verifica pertenencia a través del
 * exercise_log → sesión → user_id.
 */
export async function updateSet(fd: FormData): Promise<void> {
  const session = await requireUser();
  const id = str(fd.get("id"));
  const exerciseLogId = str(fd.get("exercise_log_id"));
  if (!id || !exerciseLogId) throw new Error("Faltan datos de la serie");

  const sessionId = await assertExerciseLogOwner(exerciseLogId, session.userId);
  const { error } = await getSupabase()
    .from("gym_workout_set_logs")
    .update({
      actual_reps: numOrNull(fd.get("actual_reps")),
      actual_weight: numOrNull(fd.get("actual_weight")),
      weight_unit: strOrNull(fd.get("weight_unit")) ?? "kg",
      effort_level: numOrNull(fd.get("effort_level")),
      completed: boolFrom(fd.get("completed")),
      notes: strOrNull(fd.get("notes")),
    })
    .eq("id", id)
    .eq("workout_exercise_log_id", exerciseLogId);
  if (error) throw new Error(error.message);
  revalidatePath(`/gimnasio/entrenar/${sessionId}`);
}

/** Borra una serie de un ejercicio en curso. */
export async function deleteSet(setId: string, exerciseLogId: string): Promise<void> {
  const session = await requireUser();
  const sessionId = await assertExerciseLogOwner(exerciseLogId, session.userId);
  const { error } = await getSupabase()
    .from("gym_workout_set_logs")
    .delete()
    .eq("id", setId)
    .eq("workout_exercise_log_id", exerciseLogId);
  if (error) throw new Error(error.message);
  revalidatePath(`/gimnasio/entrenar/${sessionId}`);
}

/** Finaliza la sesión: calcula duración, guarda esfuerzo y notas. */
export async function finishWorkout(fd: FormData): Promise<void> {
  const session = await requireUser();
  const id = str(fd.get("id"));
  if (!id) throw new Error("Falta el id de la sesión");
  await assertSessionOwner(id, session.userId);

  const sb = getSupabase();
  const { data: row } = await sb
    .from("gym_workout_sessions")
    .select("started_at")
    .eq("id", id)
    .maybeSingle();
  const startedAt = (row as { started_at: string | null } | null)?.started_at;
  const finishedAt = new Date();
  const duration = startedAt
    ? Math.max(0, Math.round((finishedAt.getTime() - new Date(startedAt).getTime()) / 60000))
    : null;

  const { error } = await sb
    .from("gym_workout_sessions")
    .update({
      status: "completed",
      finished_at: finishedAt.toISOString(),
      duration_minutes: numOrNull(fd.get("duration_minutes")) ?? duration,
      overall_effort: numOrNull(fd.get("overall_effort")),
      notes: strOrNull(fd.get("notes")),
    })
    .eq("id", id)
    .eq("user_id", session.userId);
  if (error) throw new Error(error.message);

  // Genera el análisis IA automáticamente al cerrar. Best-effort: si falla
  // (sin ejercicios, error de red), no bloquea el cierre del entrenamiento.
  try {
    await buildAndSaveAnalysis(session.userId, id);
  } catch {
    // El usuario puede generarlo luego con el botón del detalle.
  }

  revalidateModule();
  redirect(`/gimnasio/historial/${id}`);
}

/** Cancela una sesión en curso. */
export async function cancelWorkout(id: string): Promise<void> {
  const session = await requireUser();
  await assertSessionOwner(id, session.userId);
  const { error } = await getSupabase()
    .from("gym_workout_sessions")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.userId);
  if (error) throw new Error(error.message);
  revalidateModule();
  redirect("/gimnasio/historial");
}

// ===========================================================================
//  Fase 2 — Análisis IA: objetivo (rutina) vs realizado (sesión)
// ===========================================================================

/**
 * Genera (o regenera) el análisis IA de una sesión. Calcula la comparación
 * determinista objetivo vs realizado y deja que la IA redacte la narrativa.
 * Guarda en gym_workout_analyses (1 por sesión) y audita la llamada.
 */
export async function generateWorkoutAnalysis(sessionId: string): Promise<void> {
  const session = await requireUser();
  await buildAndSaveAnalysis(session.userId, sessionId);
  revalidatePath(`/gimnasio/historial/${sessionId}`);
}

/**
 * Núcleo del análisis: calcula la comparación, llama a la IA, guarda en
 * gym_workout_analyses (upsert) y audita. Reutilizado por el botón manual y por
 * el cierre automático de la sesión. No revalida (lo hace quien la llama).
 */
async function buildAndSaveAnalysis(userId: string, sessionId: string): Promise<void> {
  const workout = await getSessionWithLogs(sessionId, userId);
  if (!workout) throw new Error("Sesión no encontrada");
  if (workout.exercise_logs.length === 0) {
    throw new Error("La sesión no tiene ejercicios para analizar");
  }

  const comparison = compareWorkout(workout.exercise_logs);
  const analysis = await analyzeWorkout({
    routineName: workout.routine_name,
    durationMinutes: workout.duration_minutes,
    overallEffort: workout.overall_effort,
    comparison,
  });

  const sb = getSupabase();
  const isMock = !isGymAiConfigured();

  const { error } = await sb.from("gym_workout_analyses").upsert(
    {
      workout_session_id: sessionId,
      user_id: userId,
      summary: analysis.summary,
      what_went_well: analysis.what_went_well,
      to_improve: analysis.to_improve,
      next_focus: analysis.next_focus,
      comparison,
      source: isMock ? "ai_mock" : "ai",
      is_mock: isMock,
    },
    { onConflict: "workout_session_id" },
  );
  if (error) throw new Error(error.message);

  await sb.from("gym_ai_requests").insert({
    user_id: userId,
    request_type: "workout_analysis",
    is_mock: isMock,
    request_payload: { session_id: sessionId, comparison },
    response_payload: analysis,
  });
}

// ===========================================================================
//  Coach IA — chat del gimnasio
// ===========================================================================

export interface GymChatResult {
  reply: string;
  /** Rutina propuesta si el mensaje pedía armar una; lista para crear con un clic. */
  proposal: RoutineProposal | null;
}

/** Guarda el mensaje del usuario, obtiene respuesta del coach, la guarda y la devuelve. */
export async function sendGymChatMessage(message: string): Promise<GymChatResult> {
  const session = await requireUser();
  const text = message.trim();
  if (!text) throw new Error("El mensaje está vacío");

  const sb = getSupabase();
  await sb.from("gym_chat_messages").insert({
    user_id: session.userId,
    role: "user",
    content: text,
  });

  // Contexto COMPLETO de la persona: para que el coach la conozca de verdad
  // (perfil, nutrición de hoy, hábitos e historial de gimnasio).
  const today = todayKey(session.timeZone);
  const [
    profile,
    goal,
    todaySummary,
    activeTasks,
    weekReport,
    { data: routines },
    { count },
    weekCount,
    { data: lastAnalysis },
  ] = await Promise.all([
    getNutritionProfileByUserId(session.userId),
    getActiveNutritionGoal(session.userId),
    getDailySummary(session.userId, today),
    listActiveTasks(session.userId),
    reportOverall(session.userId, weekRange(today)),
    sb
      .from("gym_routines")
      .select("name")
      .eq("user_id", session.userId)
      .is("deleted_at", null)
      .eq("is_active", true)
      .limit(10),
    sb
      .from("gym_workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId),
    sb
      .from("gym_workout_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", session.userId)
      .gte("session_date", weekRange(today).start)
      .lte("session_date", weekRange(today).end),
    sb
      .from("gym_workout_analyses")
      .select("summary")
      .eq("user_id", session.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Objetivo legible: primer objetivo del perfil (CSV) o su descripción libre.
  const firstGoal = (profile?.main_goal ?? "").split(",").map((s) => s.trim()).filter(Boolean)[0];
  const goalMain =
    (firstGoal && MAIN_GOAL_LABELS[firstGoal as MainGoal]) ||
    profile?.goal_description ||
    firstGoal ||
    null;

  const restrictions = [
    profile?.allergies,
    profile?.intolerances,
    profile?.dietary_restrictions,
    profile?.health_notes,
  ]
    .filter(Boolean)
    .join("; ") || null;

  const ctx: GymChatContext = {
    goalMain,
    sex: profile?.sex ? SEX_LABELS[profile.sex as Sex] ?? profile.sex : null,
    age: profile?.age ?? null,
    weightKg: profile?.weight_kg ?? null,
    heightCm: profile?.height_cm ?? null,
    activityLevel: profile?.activity_level
      ? ACTIVITY_LEVEL_LABELS[profile.activity_level as ActivityLevel] ?? profile.activity_level
      : null,
    restrictions,
    dailyCaloriesGoal: goal?.daily_calories ?? null,
    proteinGoal: goal?.daily_protein_g ?? null,
    caloriesToday: todaySummary?.total_calories ?? null,
    activeHabits: activeTasks.length,
    weekHabitPct: weekReport?.pct ?? null,
    routineNames: ((routines ?? []) as { name: string }[]).map((r) => r.name),
    totalSessions: count ?? 0,
    sessionsThisWeek: weekCount.count ?? 0,
    lastSessionSummary: (lastAnalysis as { summary: string | null } | null)?.summary ?? null,
  };

  // Si pide armar una rutina, generamos también la propuesta accionable.
  const wantsRoutine = looksLikeRoutineRequest(text);
  const [reply, proposal] = await Promise.all([
    gymChatReply(text, ctx),
    wantsRoutine
      ? listExercisesForUser(session.userId).then((cat) => proposeRoutine(text, cat))
      : Promise.resolve(null),
  ]);

  await sb.from("gym_chat_messages").insert({
    user_id: session.userId,
    role: "assistant",
    content: reply,
  });
  await sb.from("gym_ai_requests").insert({
    user_id: session.userId,
    request_type: "chat",
    is_mock: !isGymAiConfigured(),
    request_payload: { message: text },
    response_payload: { reply, has_proposal: Boolean(proposal) },
  });

  revalidatePath("/gimnasio/coach");
  return { reply, proposal };
}

/**
 * Crea una rutina real a partir de una propuesta del coach. Valida los
 * exercise_id contra el catálogo del usuario (globales + propios) para no
 * insertar ids ajenos. Devuelve el id de la rutina creada.
 */
export async function createRoutineFromProposal(
  proposal: RoutineProposal,
): Promise<string> {
  const session = await requireUser();
  const name = (proposal?.name ?? "").trim() || "Rutina sugerida";

  // Whitelist de ejercicios válidos para este usuario.
  const catalog = await listExercisesForUser(session.userId);
  const validIds = new Set(catalog.map((e) => e.id));
  const items = (proposal?.exercises ?? []).filter(
    (e) => e.exercise_id && validIds.has(e.exercise_id),
  );
  if (items.length === 0) throw new Error("La propuesta no tiene ejercicios válidos");

  const sb = getSupabase();
  const { data, error } = await sb
    .from("gym_routines")
    .insert({
      user_id: session.userId,
      created_by: session.userId,
      name,
      description: "Creada por el Coach IA",
      objective: proposal.objective ?? null,
      difficulty_level: proposal.difficulty_level ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const routineId = (data as { id: string }).id;

  const rows = items.map((e, i) => ({
    routine_id: routineId,
    exercise_id: e.exercise_id!,
    order_index: i,
    target_sets: e.target_sets ?? 3,
    target_reps: e.target_reps ?? null,
    target_weight: e.target_weight ?? null,
    target_weight_unit: "kg",
    rest_seconds: e.rest_seconds ?? null,
  }));
  const { error: exErr } = await sb.from("gym_routine_exercises").insert(rows);
  if (exErr) throw new Error(exErr.message);

  revalidateModule();
  return routineId;
}

/** Borra una sesión del historial por completo (cascade a logs y series). */
export async function deleteWorkout(id: string): Promise<void> {
  const session = await requireUser();
  const { error } = await getSupabase()
    .from("gym_workout_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", session.userId);
  if (error) throw new Error(error.message);
  revalidateModule();
}
