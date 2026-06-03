/**
 * Tipos del módulo Entrenamiento de Gimnasio (Fase 1). Espejan las tablas de
 * `supabase/gym.sql`. Puros (sin imports de servidor) → usables tanto en Server
 * como en Client Components.
 *
 * Distinción central del módulo:
 *  - PLANIFICADO: GymRoutine + GymRoutineExercise (el objetivo).
 *  - REALIZADO:   GymWorkoutSession + GymWorkoutExerciseLog + GymWorkoutSetLog.
 */

// ---------------------------------------------------------------------------
//  Catálogos / enums
// ---------------------------------------------------------------------------

export const MUSCLE_GROUPS = [
  "pecho",
  "espalda",
  "hombros",
  "biceps",
  "triceps",
  "abdomen",
  "piernas",
  "gluteos",
  "cuerpo_completo",
  "cardio",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  pecho: "Pecho",
  espalda: "Espalda",
  hombros: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  abdomen: "Abdomen",
  piernas: "Piernas",
  gluteos: "Glúteos",
  cuerpo_completo: "Cuerpo completo",
  cardio: "Cardio",
};

export function muscleGroupLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return MUSCLE_GROUP_LABELS[value as MuscleGroup] ?? value;
}

export const EQUIPMENT_OPTIONS = [
  "barra",
  "mancuerna",
  "maquina",
  "polea",
  "peso_corporal",
  "banda",
  "kettlebell",
  "otro",
] as const;

export type Equipment = (typeof EQUIPMENT_OPTIONS)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barra: "Barra",
  mancuerna: "Mancuerna",
  maquina: "Máquina",
  polea: "Polea",
  peso_corporal: "Peso corporal",
  banda: "Banda elástica",
  kettlebell: "Kettlebell",
  otro: "Otro",
};

export function equipmentLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return EQUIPMENT_LABELS[value as Equipment] ?? value;
}

export const EXERCISE_TYPE_OPTIONS = [
  "fuerza",
  "hipertrofia",
  "resistencia",
  "cardio",
  "movilidad",
  "potencia",
] as const;

export type ExerciseType = (typeof EXERCISE_TYPE_OPTIONS)[number];

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  fuerza: "Fuerza",
  hipertrofia: "Hipertrofia",
  resistencia: "Resistencia",
  cardio: "Cardio",
  movilidad: "Movilidad",
  potencia: "Potencia",
};

export type DifficultyLevel = "principiante" | "intermedio" | "avanzado";

export const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
};

export function difficultyLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return DIFFICULTY_LABELS[value as DifficultyLevel] ?? value;
}

export type WorkoutStatus = "in_progress" | "completed" | "cancelled";

export const WORKOUT_STATUS_LABELS: Record<WorkoutStatus, string> = {
  in_progress: "En progreso",
  completed: "Completado",
  cancelled: "Cancelado",
};

// ---------------------------------------------------------------------------
//  Filas de tablas
// ---------------------------------------------------------------------------

export interface GymExercise {
  id: string;
  name: string;
  description: string | null;
  primary_muscle_group: string;
  secondary_muscle_groups: string[] | null;
  equipment: string | null;
  exercise_type: string | null;
  image_url: string | null;
  image_path: string | null;
  animation_url: string | null;
  instructions: string | null;
  is_global: boolean;
  user_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GymRoutine {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  objective: string | null;
  difficulty_level: string | null;
  estimated_duration_minutes: number | null;
  is_active: boolean;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GymRoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  target_reps: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_weight: number | null;
  target_weight_unit: string;
  rest_seconds: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Ejercicio planificado con su ejercicio del catálogo embebido (join). */
export interface GymRoutineExerciseWithExercise extends GymRoutineExercise {
  exercise: GymExercise | null;
}

/** Rutina con sus ejercicios planificados (orden ascendente). */
export interface GymRoutineWithExercises extends GymRoutine {
  exercises: GymRoutineExerciseWithExercise[];
}

export interface GymWorkoutSession {
  id: string;
  user_id: string;
  routine_id: string | null;
  routine_name: string | null;
  session_date: string; // YYYY-MM-DD
  started_at: string | null;
  finished_at: string | null;
  duration_minutes: number | null;
  overall_effort: number | null;
  status: WorkoutStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GymWorkoutExerciseLog {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  routine_exercise_id: string | null;
  exercise_name: string | null;
  order_index: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
  is_completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GymWorkoutSetLog {
  id: string;
  workout_exercise_log_id: string;
  set_number: number;
  target_reps: number | null;
  actual_reps: number | null;
  target_weight: number | null;
  actual_weight: number | null;
  weight_unit: string;
  effort_level: number | null;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** Log de ejercicio con sus series reales (orden por set_number). */
export interface GymWorkoutExerciseLogWithSets extends GymWorkoutExerciseLog {
  sets: GymWorkoutSetLog[];
  exercise: GymExercise | null;
}

/** Sesión real completa con ejercicios y series (para entrenar / ver detalle). */
export interface GymWorkoutSessionWithLogs extends GymWorkoutSession {
  exercise_logs: GymWorkoutExerciseLogWithSets[];
}

// ---------------------------------------------------------------------------
//  Resumen de una sesión (cálculos Fase 1)
// ---------------------------------------------------------------------------

export interface SessionVolumeSummary {
  totalVolume: number;        // Σ actual_weight * actual_reps de series completadas
  completedSets: number;      // total de series completadas
  totalReps: number;          // total de repeticiones realizadas
  exerciseCount: number;      // ejercicios en la sesión
}

// ---------------------------------------------------------------------------
//  Fase 2 — Comparación objetivo vs realizado + análisis IA
// ---------------------------------------------------------------------------

export type ComparisonStatus =
  | "cumplido" // alcanzó el objetivo
  | "parcial" // por debajo del objetivo
  | "superado" // por encima del objetivo
  | "sin_objetivo"; // ejercicio libre, sin objetivo planificado

/** Comparación determinista (números exactos) de un ejercicio dentro de una sesión. */
export interface ExerciseComparison {
  exercise_log_id: string;
  exercise_name: string;
  muscle_group: string | null;
  target_sets: number | null;
  done_sets: number; // series completadas
  target_reps: number | null;
  avg_actual_reps: number | null;
  target_weight: number | null;
  avg_actual_weight: number | null; // promedio de peso en series completadas
  max_actual_weight: number | null;
  planned_volume: number | null; // target_sets * target_reps * target_weight
  actual_volume: number; // Σ peso*reps reales
  adherence_pct: number | null; // actual_volume / planned_volume * 100
  status: ComparisonStatus;
}

/** Resumen de comparación de toda la sesión. */
export interface WorkoutComparison {
  exercises: ExerciseComparison[];
  planned_volume: number | null;
  actual_volume: number;
  overall_adherence_pct: number | null;
  completed_exercises: number; // ejercicios marcados completados
  total_exercises: number;
}

/** Salida narrativa de la IA (prosa). Los números viven en WorkoutComparison. */
export interface WorkoutAnalysis {
  summary: string;
  what_went_well: string[];
  to_improve: string[];
  next_focus: string;
}

export interface GymChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/** Un ejercicio propuesto por el coach, ya emparejado con el catálogo si fue posible. */
export interface RoutineProposalExercise {
  exercise_id: string | null; // id del catálogo si hubo match; null si no existe
  name: string;
  muscle_group: string | null;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
}

/** Rutina propuesta por el coach IA, lista para crear con un clic. */
export interface RoutineProposal {
  name: string;
  objective: string | null;
  difficulty_level: string | null;
  exercises: RoutineProposalExercise[];
}

/** Fila persistida en gym_workout_analyses. */
export interface GymWorkoutAnalysisRow {
  id: string;
  workout_session_id: string;
  user_id: string;
  summary: string | null;
  what_went_well: string[] | null;
  to_improve: string[] | null;
  next_focus: string | null;
  comparison: WorkoutComparison | null;
  source: string; // 'ai' | 'ai_mock'
  is_mock: boolean;
  created_at: string;
  updated_at: string;
}
