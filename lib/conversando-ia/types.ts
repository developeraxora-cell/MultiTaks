/**
 * Tipos puros del módulo Conversando IA. La IA funciona como guía de
 * autoconocimiento emocional y hábitos, no como terapeuta ni diagnóstico.
 */

export type LifeArea =
  | "dinero"
  | "amor"
  | "salud"
  | "familia"
  | "trabajo"
  | "proposito"
  | "espiritualidad";

export type InsightPhase = "collecting" | "first_reading" | "full_analysis" | "transformation";

export type BlockageStatus = "proposed" | "active" | "completed" | "paused";

/** Umbrales de producción del módulo (días). */
export const FIRST_READING_DAYS = 7;
export const FULL_ANALYSIS_DAYS = 14;
export const TRANSFORMATION_DAYS = 15;
export const RESOLUTION_WINDOW_DAYS = 15;
export const RESOLUTION_SUCCESS_PCT = 90;
export const WEEKLY_CHECKIN_GATE_DAYS = 7;
export const MAX_ACTIVE_BLOCKAGES = 2;

export interface EmotionalRecord {
  id: string;
  user_id: string;
  recorded_at: string;
  record_date: string;
  situation: string;
  emotion: string;
  intensity: number;
  body_sensation: string;
  possible_trigger: string | null;
  automatic_thought: string | null;
  behavior_impulse: string;
  life_area: LifeArea;
  created_at: string;
  updated_at: string;
}

export interface PatternInsight {
  phase: InsightPhase;
  days_observed: number;
  records_count: number;
  message: string;
  repeated_emotions: string[];
  frequent_triggers: string[];
  body_sensations: string[];
  automatic_behaviors: string[];
  possible_beliefs: string[];
  priority_blockages: string[];
}

export interface BlockagePlan {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  possible_belief: string | null;
  audio_suggestion: string | null;
  daily_habit: string | null;
  affirmation: string | null;
  real_action: string | null;
  followup_question: string | null;
  status: BlockageStatus;
  priority: number;
  resolved_at: string | null;
  started_at: string;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Cumplimiento de un hábito enlazado a un bloqueo en la ventana de evaluación. */
export interface HabitProgress {
  task_id: string;
  title: string;
  completed: number;
  eligible: number;
  pct: number;
}

/** Progreso agregado de un bloqueo activo: hábitos + métrica de resolución. */
export interface BlockageProgress {
  plan_id: string;
  habits: HabitProgress[];
  overall_pct: number;
  days_tracked: number;
  is_resolved: boolean;
}

export interface WeeklyCheckIn {
  id: string;
  user_id: string;
  blockage_plan_id: string;
  intensity_score: number;
  notes: string | null;
  ai_reply: string;
  created_at: string;
}

export interface EmotionalChatMessage {
  role: "assistant" | "user";
  content: string;
  at: string;
}

export interface EmotionalConversation {
  id: string;
  user_id: string;
  record_id: string | null;
  title: string;
  messages: EmotionalChatMessage[];
  extracted_record: Partial<EmotionalRecord> | null;
  ai_summary: string | null;
  created_at: string;
}

export type EmotionalExtraction = {
  situation: string;
  emotion: string;
  intensity: number | null;
  body_sensation: string;
  possible_trigger: string;
  automatic_thought: string;
  behavior_impulse: string;
  life_area: LifeArea | null;
};

export interface GuidedConversationTurn {
  assistant_message: string;
  extraction: EmotionalExtraction;
  missing_fields: Array<keyof EmotionalExtraction>;
  ready_to_analyze: boolean;
}

export interface ConversandoDashboardData {
  records: EmotionalRecord[];
  conversations: EmotionalConversation[];
  activePlan: BlockagePlan | null;
  checkIns: WeeklyCheckIn[];
  insight: PatternInsight;
}

export const LIFE_AREA_LABELS: Record<LifeArea, string> = {
  dinero: "Dinero",
  amor: "Amor",
  salud: "Salud",
  familia: "Familia",
  trabajo: "Trabajo",
  proposito: "Propósito",
  espiritualidad: "Espiritualidad",
};
