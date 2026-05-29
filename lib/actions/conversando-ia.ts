"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/server";
import { todayKey } from "@/lib/date";
import {
  buildPatternInsight,
  buildTransformationPlan,
  buildWeeklyFollowupReply,
  continueGuidedConversation,
  isConversandoAiConfigured,
} from "@/lib/conversando-ia/ai";
import type {
  BlockagePlan,
  BlockageProgress,
  EmotionalChatMessage,
  EmotionalExtraction,
  GuidedConversationTurn,
  LifeArea,
  PatternInsight,
  WeeklyCheckIn,
} from "@/lib/conversando-ia/types";
import { MAX_ACTIVE_BLOCKAGES, WEEKLY_CHECKIN_GATE_DAYS } from "@/lib/conversando-ia/types";
import {
  getBlockagePlans,
  getBlockageProgress,
  getEmotionalRecords,
  getWeeklyCheckIns,
} from "@/lib/queries/conversando-ia";
import { getSupabase } from "@/lib/supabase/server";

function daysSinceNow(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v.trim() : "";
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = str(v);
  return s === "" ? null : s;
}

function num(v: FormDataEntryValue | null, fallback = 1): number {
  const n = Number(str(v));
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function revalidateModule() {
  revalidatePath("/conversando-ia");
}

export async function createEmotionalRecord(fd: FormData): Promise<string> {
  const session = await requireUser();
  const situation = str(fd.get("situation"));
  const emotion = str(fd.get("emotion"));
  const body_sensation = str(fd.get("body_sensation"));
  const behavior_impulse = str(fd.get("behavior_impulse"));
  const life_area = str(fd.get("life_area")) as LifeArea;

  if (!situation || !emotion || !body_sensation || !behavior_impulse || !life_area) {
    throw new Error("Completa los campos principales del registro emocional");
  }

  const { error } = await getSupabase().from("emotional_records").insert({
    user_id: session.userId,
    record_date: todayKey(session.timeZone),
    situation,
    emotion,
    intensity: clamp(num(fd.get("intensity"), 5), 1, 10),
    body_sensation,
    possible_trigger: strOrNull(fd.get("possible_trigger")),
    automatic_thought: strOrNull(fd.get("automatic_thought")),
    behavior_impulse,
    life_area,
  });
  if (error) throw new Error(error.message);

  revalidateModule();
  return "Gracias, quedó registrado. No necesitamos entenderlo todo ahora. Si esto se repite, en unos días podremos detectar un patrón.";
}

export async function continueEmotionalChat(input: {
  messages: EmotionalChatMessage[];
  extraction: EmotionalExtraction;
}): Promise<GuidedConversationTurn> {
  const session = await requireUser();
  return continueGuidedConversation({
    userName: session.name,
    messages: input.messages,
    extraction: input.extraction,
  });
}

export async function saveGuidedEmotionalConversation(input: {
  messages: EmotionalChatMessage[];
  situation: string;
  emotion: string;
  intensity: number;
  body_sensation: string;
  possible_trigger: string;
  automatic_thought: string;
  behavior_impulse: string;
  life_area: LifeArea;
}): Promise<string> {
  const session = await requireUser();
  const situation = input.situation.trim();
  const emotion = input.emotion.trim();
  const bodySensation = input.body_sensation.trim();
  const behaviorImpulse = input.behavior_impulse.trim();

  if (!situation || !emotion || !bodySensation || !behaviorImpulse) {
    throw new Error("La conversación aún no tiene suficiente información para guardarse");
  }

  const sb = getSupabase();
  const recordDate = todayKey(session.timeZone);
  const { data: record, error: recordError } = await sb
    .from("emotional_records")
    .insert({
      user_id: session.userId,
      record_date: recordDate,
      situation,
      emotion,
      intensity: clamp(Number(input.intensity) || 5, 1, 10),
      body_sensation: bodySensation,
      possible_trigger: input.possible_trigger.trim() || null,
      automatic_thought: input.automatic_thought.trim() || null,
      behavior_impulse: behaviorImpulse,
      life_area: input.life_area,
    })
    .select("*")
    .single();
  if (recordError) throw new Error(recordError.message);

  const records = await getEmotionalRecords(session.userId, 120);
  const insight = await buildPatternInsight(records);
  const summary = conversationSummary({
    emotion,
    bodySensation,
    behaviorImpulse,
    insight,
  });

  const title = `${emotion} · ${recordDate}`;
  const { error: conversationError } = await sb.from("emotional_conversations").insert({
    user_id: session.userId,
    record_id: (record as { id: string }).id,
    title,
    messages: input.messages,
    extracted_record: {
      situation,
      emotion,
      intensity: clamp(Number(input.intensity) || 5, 1, 10),
      body_sensation: bodySensation,
      possible_trigger: input.possible_trigger.trim() || null,
      automatic_thought: input.automatic_thought.trim() || null,
      behavior_impulse: behaviorImpulse,
      life_area: input.life_area,
      record_date: recordDate,
    },
    ai_summary: summary,
  });
  if (conversationError) throw new Error(conversationError.message);

  await sb.from("ai_emotional_requests").insert({
    user_id: session.userId,
    request_type: "conversation_summary",
    is_mock: !isConversandoAiConfigured(),
    request_payload: { record_id: (record as { id: string }).id, messages_count: input.messages.length },
    response_payload: { summary, insight_phase: insight.phase },
  });

  revalidateModule();
  return summary;
}

export async function refreshConversandoInsight(): Promise<PatternInsight> {
  const session = await requireUser();
  const sb = getSupabase();
  const records = await getEmotionalRecords(session.userId, 120);

  // No repetir bloqueos que ya se trabajan o ya se resolvieron.
  const plans = await getBlockagePlans(session.userId);
  const lockedTitles = plans
    .filter((p) => p.status === "active" || p.status === "completed")
    .map((p) => p.title);

  const insight = await buildPatternInsight(records, lockedTitles);

  await sb.from("ai_emotional_requests").insert({
    user_id: session.userId,
    request_type: insight.phase,
    is_mock: !isConversandoAiConfigured(),
    request_payload: { records_count: records.length, days_observed: insight.days_observed },
    response_payload: insight,
  });

  // Desde el análisis completo (día 14+) guardamos hasta 2 bloqueos propuestos.
  // El plan completo (hábitos, afirmación, etc.) se genera al aceptar cada uno.
  if (insight.phase === "full_analysis" && insight.priority_blockages.length > 0) {
    await sb
      .from("emotional_blockage_plans")
      .delete()
      .eq("user_id", session.userId)
      .eq("status", "proposed");

    const rows = insight.priority_blockages.slice(0, 2).map((title, i) => ({
      user_id: session.userId,
      title,
      possible_belief: insight.possible_beliefs[i] ?? insight.possible_beliefs[0] ?? null,
      status: "proposed" as const,
      priority: i + 1,
    }));
    const { error } = await sb.from("emotional_blockage_plans").insert(rows);
    if (error) throw new Error(error.message);
  }

  revalidateModule();
  return insight;
}

/**
 * Acepta un bloqueo propuesto: genera su plan completo con la IA y lo activa.
 * Respeta el límite de bloqueos activos simultáneos.
 */
export async function acceptBlockage(planId: string): Promise<BlockagePlan> {
  const session = await requireUser();
  const sb = getSupabase();

  const { data: planRow, error } = await sb
    .from("emotional_blockage_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", session.userId)
    .single();
  if (error) throw new Error(error.message);
  const current = planRow as BlockagePlan;

  if (current.status === "active") return current;
  if (current.status !== "proposed") {
    throw new Error("Este bloqueo ya no está disponible para iniciar");
  }

  const { count, error: countError } = await sb
    .from("emotional_blockage_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.userId)
    .eq("status", "active");
  if (countError) throw new Error(countError.message);
  if ((count ?? 0) >= MAX_ACTIVE_BLOCKAGES) {
    throw new Error(
      `Ya estás trabajando ${MAX_ACTIVE_BLOCKAGES} bloqueos a la vez. Resuelve o pausa uno antes de empezar otro.`,
    );
  }

  const records = await getEmotionalRecords(session.userId, 120);
  if (records.length === 0) {
    throw new Error("Primero registra al menos una conversación para iniciar la transformación");
  }
  const insight = await buildPatternInsight(records);
  const generated = await buildTransformationPlan(records, {
    ...insight,
    priority_blockages: [current.title],
    possible_beliefs: current.possible_belief ? [current.possible_belief] : insight.possible_beliefs,
  });

  const { data: updated, error: updateError } = await sb
    .from("emotional_blockage_plans")
    .update({
      title: current.title,
      description: generated.description,
      possible_belief: generated.possible_belief,
      audio_suggestion: generated.audio_suggestion,
      daily_habit: generated.daily_habit,
      affirmation: generated.affirmation,
      real_action: generated.real_action,
      followup_question: generated.followup_question,
      status: "active",
      started_at: new Date().toISOString(),
    })
    .eq("id", planId)
    .eq("user_id", session.userId)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);

  revalidateModule();
  return updated as BlockagePlan;
}

/**
 * Carga el seguimiento de un bloqueo activo: progreso de hábitos, check-ins y si
 * ya toca el comentario semanal. Auto-resuelve el bloqueo si llegó al umbral.
 */
export async function loadBlockageTracking(planId: string): Promise<{
  plan: BlockagePlan;
  progress: BlockageProgress;
  checkIns: WeeklyCheckIn[];
  canCheckIn: boolean;
  nextCheckInInDays: number;
}> {
  const session = await requireUser();
  const sb = getSupabase();

  const { data, error } = await sb
    .from("emotional_blockage_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", session.userId)
    .single();
  if (error) throw new Error(error.message);
  let plan = data as BlockagePlan;

  const progress = await getBlockageProgress(plan);

  if (progress.is_resolved && plan.status === "active") {
    const { data: resolved, error: resolveError } = await sb
      .from("emotional_blockage_plans")
      .update({ status: "completed", resolved_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("user_id", session.userId)
      .select("*")
      .single();
    if (resolveError) throw new Error(resolveError.message);
    plan = resolved as BlockagePlan;
    revalidateModule();
  }

  const checkIns = await getWeeklyCheckIns(session.userId, planId);
  const last = checkIns[checkIns.length - 1];
  const sinceLast = last ? daysSinceNow(last.created_at) : Number.POSITIVE_INFINITY;
  const canCheckIn = plan.status === "active" && sinceLast >= WEEKLY_CHECKIN_GATE_DAYS;
  const nextCheckInInDays = canCheckIn ? 0 : Math.max(0, WEEKLY_CHECKIN_GATE_DAYS - sinceLast);

  return { plan, progress, checkIns, canCheckIn, nextCheckInInDays };
}

export async function includeTransformationHabit(input: {
  title: string;
  category?: string;
  blockagePlanId?: string;
}): Promise<{ status: "created" | "exists" }> {
  const session = await requireUser();
  const title = input.title.trim();
  if (!title) throw new Error("El hábito no tiene título");

  const category = input.category && [
    "amigos",
    "salud",
    "dinero",
    "amor",
    "familia",
    "profesion",
    "desarrollo_personal",
    "ocio",
  ].includes(input.category)
    ? input.category
    : "desarrollo_personal";

  const supabase = getSupabase();

  const { data: existing, error: existingError } = await supabase
    .from("tasks")
    .select("id")
    .eq("user_id", session.userId)
    .eq("title", title)
    .limit(1)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing) return { status: "exists" };

  const { error } = await supabase.from("tasks").insert({
    user_id: session.userId,
    assigned_by: null,
    title,
    category,
    blockage_plan_id: input.blockagePlanId ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/tasks");
  revalidatePath("/tracker");
  revalidatePath("/reports");
  revalidateModule();
  return { status: "created" };
}

export async function createWeeklyCheckIn(fd: FormData): Promise<string> {
  const session = await requireUser();
  const planId = str(fd.get("plan_id"));
  const score = clamp(num(fd.get("intensity_score"), 5), 1, 10);
  const notes = str(fd.get("notes"));
  if (!planId) throw new Error("Falta el plan activo");

  const sb = getSupabase();
  const { data, error } = await sb
    .from("emotional_blockage_plans")
    .select("*")
    .eq("id", planId)
    .eq("user_id", session.userId)
    .single();
  if (error) throw new Error(error.message);

  // Gate: el comentario semanal se habilita una vez cada 7 días.
  const recentCheckIns = await getWeeklyCheckIns(session.userId, planId, 1);
  const last = recentCheckIns[recentCheckIns.length - 1];
  if (last && daysSinceNow(last.created_at) < WEEKLY_CHECKIN_GATE_DAYS) {
    throw new Error("El comentario semanal aún no está disponible. Se habilita una vez por semana.");
  }

  const reply = await buildWeeklyFollowupReply(data, score, notes);

  const { error: insertError } = await sb.from("emotional_weekly_checkins").insert({
    user_id: session.userId,
    blockage_plan_id: planId,
    intensity_score: score,
    notes: notes || null,
    ai_reply: reply,
  });
  if (insertError) throw new Error(insertError.message);

  // La resolución del bloqueo se decide por cumplimiento de hábitos (≥90% / 15 días),
  // no por el puntaje del check-in. Aquí solo registramos la fecha del seguimiento.
  const { error: updateError } = await sb
    .from("emotional_blockage_plans")
    .update({ last_checked_at: new Date().toISOString() })
    .eq("id", planId)
    .eq("user_id", session.userId);
  if (updateError) throw new Error(updateError.message);

  await sb.from("ai_emotional_requests").insert({
    user_id: session.userId,
    request_type: "weekly_followup",
    is_mock: !isConversandoAiConfigured(),
    request_payload: { plan_id: planId, intensity_score: score, notes },
    response_payload: { reply },
  });

  revalidateModule();
  return reply;
}

function conversationSummary({
  emotion,
  bodySensation,
  behaviorImpulse,
  insight,
}: {
  emotion: string;
  bodySensation: string;
  behaviorImpulse: string;
  insight: PatternInsight;
}): string {
  if (insight.phase === "collecting") {
    return `Gracias por contármelo. Hoy quedó registrado que apareció ${emotion}, lo sentiste en ${bodySensation} y tu impulso fue ${behaviorImpulse}. No necesitamos entenderlo todo ahora. Aún estamos recopilando información; si esto se repite, en unos días podremos detectar un patrón.`;
  }
  if (insight.phase === "first_reading") {
    return `${insight.message}\n\nLo de hoy ya quedó guardado como parte de esa observación. Sigamos mirando con calma antes de sacar una conclusión fuerte.`;
  }
  return `${insight.message}\n\nLo importante ahora es no trabajar todo a la vez. Vamos a enfocarnos primero en el bloqueo más repetido o el que más está afectando tu vida.`;
}
