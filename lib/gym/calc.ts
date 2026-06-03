/**
 * Cálculos básicos de Fase 1 para entrenamientos. Sin IA, solo aritmética simple.
 * Puro → usable en Server y Client Components.
 */

import type {
  ComparisonStatus,
  ExerciseComparison,
  GymWorkoutExerciseLogWithSets,
  GymWorkoutSetLog,
  SessionVolumeSummary,
  WorkoutComparison,
} from "@/lib/gym/types";

/** Volumen de una serie: peso usado * repeticiones (0 si falta algún dato). */
export function setVolume(set: GymWorkoutSetLog): number {
  if (!set.completed) return 0;
  const w = Number(set.actual_weight) || 0;
  const r = Number(set.actual_reps) || 0;
  return w * r;
}

/** Volumen total de un ejercicio: suma del volumen de todas sus series. */
export function exerciseVolume(log: GymWorkoutExerciseLogWithSets): number {
  return log.sets.reduce((acc, s) => acc + setVolume(s), 0);
}

/** Resumen agregado de una sesión: volumen, series y reps completadas. */
export function sessionSummary(
  exerciseLogs: GymWorkoutExerciseLogWithSets[],
): SessionVolumeSummary {
  let totalVolume = 0;
  let completedSets = 0;
  let totalReps = 0;

  for (const log of exerciseLogs) {
    for (const set of log.sets) {
      if (!set.completed) continue;
      totalVolume += setVolume(set);
      completedSets += 1;
      totalReps += Number(set.actual_reps) || 0;
    }
  }

  return {
    totalVolume,
    completedSets,
    totalReps,
    exerciseCount: exerciseLogs.length,
  };
}

// ---------------------------------------------------------------------------
//  Fase 2 — Comparación objetivo (rutina) vs realizado (sesión)
// ---------------------------------------------------------------------------

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Compara un ejercicio: objetivos copiados vs series reales completadas. */
export function compareExercise(log: GymWorkoutExerciseLogWithSets): ExerciseComparison {
  const completed = log.sets.filter((s) => s.completed);
  const doneSets = completed.length;

  const reps = completed.map((s) => Number(s.actual_reps) || 0).filter((r) => r > 0);
  const weights = completed
    .map((s) => Number(s.actual_weight) || 0)
    .filter((w) => w > 0);

  const avgReps = reps.length ? round1(reps.reduce((a, b) => a + b, 0) / reps.length) : null;
  const avgWeight = weights.length
    ? round1(weights.reduce((a, b) => a + b, 0) / weights.length)
    : null;
  const maxWeight = weights.length ? Math.max(...weights) : null;

  const actualVolume = exerciseVolume(log);

  // Volumen planificado solo si hay los 3 objetivos.
  const plannedVolume =
    log.target_sets != null && log.target_reps != null && log.target_weight != null
      ? Number(log.target_sets) * Number(log.target_reps) * Number(log.target_weight)
      : null;

  const adherence =
    plannedVolume && plannedVolume > 0 ? round1((actualVolume / plannedVolume) * 100) : null;

  let status: ComparisonStatus;
  if (log.target_sets == null && log.target_reps == null && log.target_weight == null) {
    status = "sin_objetivo";
  } else if (adherence == null) {
    // Sin volumen comparable: usa series como proxy.
    if (log.target_sets != null && doneSets >= log.target_sets) status = "cumplido";
    else status = "parcial";
  } else if (adherence >= 100) {
    status = adherence >= 105 ? "superado" : "cumplido";
  } else {
    status = adherence >= 90 ? "cumplido" : "parcial";
  }

  return {
    exercise_log_id: log.id,
    exercise_name: log.exercise?.name ?? log.exercise_name ?? "Ejercicio",
    muscle_group: log.exercise?.primary_muscle_group ?? null,
    target_sets: log.target_sets,
    done_sets: doneSets,
    target_reps: log.target_reps,
    avg_actual_reps: avgReps,
    target_weight: log.target_weight != null ? Number(log.target_weight) : null,
    avg_actual_weight: avgWeight,
    max_actual_weight: maxWeight,
    planned_volume: plannedVolume,
    actual_volume: actualVolume,
    adherence_pct: adherence,
    status,
  };
}

/** Comparación completa de la sesión (números exactos, sin IA). */
export function compareWorkout(
  exerciseLogs: GymWorkoutExerciseLogWithSets[],
): WorkoutComparison {
  const exercises = exerciseLogs.map(compareExercise);

  let planned = 0;
  let hasPlanned = false;
  let actual = 0;
  for (const e of exercises) {
    if (e.planned_volume != null) {
      planned += e.planned_volume;
      hasPlanned = true;
    }
    actual += e.actual_volume;
  }

  const plannedVolume = hasPlanned ? planned : null;
  const overall =
    plannedVolume && plannedVolume > 0 ? round1((actual / plannedVolume) * 100) : null;

  return {
    exercises,
    planned_volume: plannedVolume,
    actual_volume: actual,
    overall_adherence_pct: overall,
    completed_exercises: exerciseLogs.filter((l) => l.is_completed).length,
    total_exercises: exerciseLogs.length,
  };
}
