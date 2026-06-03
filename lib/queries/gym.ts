import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import type {
  GymExercise,
  GymRoutine,
  GymRoutineExerciseWithExercise,
  GymRoutineWithExercises,
  GymChatMessage,
  GymWorkoutAnalysisRow,
  GymWorkoutExerciseLogWithSets,
  GymWorkoutSession,
  GymWorkoutSessionWithLogs,
  GymWorkoutSetLog,
} from "@/lib/gym/types";

// ---------------------------------------------------------------------------
//  Catálogo de ejercicios
// ---------------------------------------------------------------------------

/**
 * Ejercicios visibles para el usuario: globales + sus personalizados.
 * Excluye los soft-deleted. Opcional filtrado por grupo muscular.
 */
export async function listExercisesForUser(
  userId: string,
  muscleGroup?: string | null,
): Promise<GymExercise[]> {
  let query = getSupabase()
    .from("gym_exercises")
    .select("*")
    .is("deleted_at", null)
    .or(`is_global.eq.true,user_id.eq.${userId}`)
    .order("name", { ascending: true });

  if (muscleGroup) query = query.eq("primary_muscle_group", muscleGroup);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as GymExercise[];
}

export async function getExercise(id: string): Promise<GymExercise | null> {
  const { data, error } = await getSupabase()
    .from("gym_exercises")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GymExercise) ?? null;
}

// ---------------------------------------------------------------------------
//  Rutinas
// ---------------------------------------------------------------------------

/** Rutinas del usuario (no eliminadas), más recientes primero. */
export async function listRoutines(userId: string): Promise<GymRoutine[]> {
  const { data, error } = await getSupabase()
    .from("gym_routines")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as GymRoutine[];
}

/** Rutina concreta del usuario (o null). Valida pertenencia por user_id. */
export async function getRoutine(id: string, userId: string): Promise<GymRoutine | null> {
  const { data, error } = await getSupabase()
    .from("gym_routines")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GymRoutine) ?? null;
}

/** Ejercicios planificados de una rutina (con el ejercicio del catálogo embebido). */
export async function listRoutineExercises(
  routineId: string,
): Promise<GymRoutineExerciseWithExercise[]> {
  const { data, error } = await getSupabase()
    .from("gym_routine_exercises")
    .select("*, exercise:gym_exercises(*)")
    .eq("routine_id", routineId)
    .order("order_index", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GymRoutineExerciseWithExercise[];
}

/** Rutina + sus ejercicios planificados. Null si no existe o no es del usuario. */
export async function getRoutineWithExercises(
  id: string,
  userId: string,
): Promise<GymRoutineWithExercises | null> {
  const routine = await getRoutine(id, userId);
  if (!routine) return null;
  const exercises = await listRoutineExercises(id);
  return { ...routine, exercises };
}

// ---------------------------------------------------------------------------
//  Sesiones de entrenamiento (historial)
// ---------------------------------------------------------------------------

/** Sesiones del usuario, más recientes primero. */
export async function listSessions(
  userId: string,
  limit = 100,
): Promise<GymWorkoutSession[]> {
  const { data, error } = await getSupabase()
    .from("gym_workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as GymWorkoutSession[];
}

/** Sesión activa (in_progress) más reciente del usuario, si existe. */
export async function getActiveSession(userId: string): Promise<GymWorkoutSession | null> {
  const { data, error } = await getSupabase()
    .from("gym_workout_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GymWorkoutSession) ?? null;
}

export interface ActiveWorkoutTimer {
  id: string;
  started_at: string | null;
  estimated_minutes: number | null;
  routine_name: string | null;
}

/**
 * Datos mínimos del cronómetro de una sesión: cuándo empezó y la duración
 * estimada de su rutina. El tiempo transcurrido se deriva de `started_at` en el
 * cliente, así el contador es exacto aunque el usuario navegue o recargue.
 */
export async function getWorkoutTimer(
  sessionId: string,
  userId: string,
): Promise<ActiveWorkoutTimer | null> {
  const { data, error } = await getSupabase()
    .from("gym_workout_sessions")
    .select("id, started_at, routine_name, routine:gym_routines(estimated_duration_minutes)")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return timerFromRow(data);
}

/** Normaliza la fila (el join `routine` llega como array u objeto según el typegen). */
function timerFromRow(data: unknown): ActiveWorkoutTimer {
  const row = data as {
    id: string;
    started_at: string | null;
    routine_name: string | null;
    routine:
      | { estimated_duration_minutes: number | null }
      | { estimated_duration_minutes: number | null }[]
      | null;
  };
  const routine = Array.isArray(row.routine) ? row.routine[0] : row.routine;
  return {
    id: row.id,
    started_at: row.started_at,
    estimated_minutes: routine?.estimated_duration_minutes ?? null,
    routine_name: row.routine_name,
  };
}

/** Cronómetro de la sesión in_progress activa (para el pill global). Null si no hay. */
export async function getActiveWorkoutTimer(
  userId: string,
): Promise<ActiveWorkoutTimer | null> {
  const { data, error } = await getSupabase()
    .from("gym_workout_sessions")
    .select("id, started_at, routine_name, routine:gym_routines(estimated_duration_minutes)")
    .eq("user_id", userId)
    .eq("status", "in_progress")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return timerFromRow(data);
}

export async function getSession(
  id: string,
  userId: string,
): Promise<GymWorkoutSession | null> {
  const { data, error } = await getSupabase()
    .from("gym_workout_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GymWorkoutSession) ?? null;
}

/**
 * Sesión completa: ejercicios realizados + series, con el ejercicio del catálogo
 * embebido. Valida pertenencia por user_id. Null si no es del usuario.
 */
export async function getSessionWithLogs(
  id: string,
  userId: string,
): Promise<GymWorkoutSessionWithLogs | null> {
  const session = await getSession(id, userId);
  if (!session) return null;

  const sb = getSupabase();
  const { data: logsData, error: logsErr } = await sb
    .from("gym_workout_exercise_logs")
    .select("*, exercise:gym_exercises(*)")
    .eq("workout_session_id", id)
    .order("order_index", { ascending: true });
  if (logsErr) throw new Error(logsErr.message);

  const logs = (logsData ?? []) as GymWorkoutExerciseLogWithSets[];
  if (logs.length === 0) return { ...session, exercise_logs: [] };

  const { data: setsData, error: setsErr } = await sb
    .from("gym_workout_set_logs")
    .select("*")
    .in("workout_exercise_log_id", logs.map((l) => l.id))
    .order("set_number", { ascending: true });
  if (setsErr) throw new Error(setsErr.message);

  const sets = (setsData ?? []) as GymWorkoutSetLog[];
  const byLog = new Map<string, GymWorkoutSetLog[]>();
  for (const s of sets) {
    const arr = byLog.get(s.workout_exercise_log_id) ?? [];
    arr.push(s);
    byLog.set(s.workout_exercise_log_id, arr);
  }

  return {
    ...session,
    exercise_logs: logs.map((l) => ({ ...l, sets: byLog.get(l.id) ?? [] })),
  };
}

/** Análisis IA guardado de una sesión (o null). Valida pertenencia por user_id. */
export async function getWorkoutAnalysis(
  sessionId: string,
  userId: string,
): Promise<GymWorkoutAnalysisRow | null> {
  const { data, error } = await getSupabase()
    .from("gym_workout_analyses")
    .select("*")
    .eq("workout_session_id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as GymWorkoutAnalysisRow) ?? null;
}

/** Mapa sessionId -> resumen IA, para mostrar en la lista de historial. */
export async function getAnalysisSummaries(
  sessionIds: string[],
): Promise<Record<string, string>> {
  if (sessionIds.length === 0) return {};
  const { data, error } = await getSupabase()
    .from("gym_workout_analyses")
    .select("workout_session_id, summary")
    .in("workout_session_id", sessionIds);
  if (error) throw new Error(error.message);

  const out: Record<string, string> = {};
  for (const row of (data ?? []) as { workout_session_id: string; summary: string | null }[]) {
    if (row.summary) out[row.workout_session_id] = row.summary;
  }
  return out;
}

/** Historial de chat del coach (orden cronológico, últimos `limit`). */
export async function getGymChatMessages(
  userId: string,
  limit = 50,
): Promise<GymChatMessage[]> {
  const { data, error } = await getSupabase()
    .from("gym_chat_messages")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as GymChatMessage[]).reverse();
}

/** Mapa sessionId -> nº de ejercicios, para la lista de historial. */
export async function countExercisesPerSession(
  sessionIds: string[],
): Promise<Record<string, number>> {
  if (sessionIds.length === 0) return {};
  const { data, error } = await getSupabase()
    .from("gym_workout_exercise_logs")
    .select("workout_session_id")
    .in("workout_session_id", sessionIds);
  if (error) throw new Error(error.message);

  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { workout_session_id: string }[]) {
    counts[row.workout_session_id] = (counts[row.workout_session_id] ?? 0) + 1;
  }
  return counts;
}
