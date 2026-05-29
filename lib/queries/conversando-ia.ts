import "server-only";

import { getSupabase } from "@/lib/supabase/server";
import type {
  BlockagePlan,
  BlockageProgress,
  EmotionalConversation,
  EmotionalRecord,
  HabitProgress,
  WeeklyCheckIn,
} from "@/lib/conversando-ia/types";
import { RESOLUTION_SUCCESS_PCT, RESOLUTION_WINDOW_DAYS } from "@/lib/conversando-ia/types";

export async function getEmotionalRecords(userId: string, limit = 80): Promise<EmotionalRecord[]> {
  const { data, error } = await getSupabase()
    .from("emotional_records")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as EmotionalRecord[]).reverse();
}

export async function getActiveBlockagePlan(userId: string): Promise<BlockagePlan | null> {
  const { data, error } = await getSupabase()
    .from("emotional_blockage_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BlockagePlan) ?? null;
}

/** Todos los bloqueos visibles en la lectura (propuestos, activos y resueltos). */
export async function getBlockagePlans(userId: string): Promise<BlockagePlan[]> {
  const { data, error } = await getSupabase()
    .from("emotional_blockage_plans")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["proposed", "active", "completed"])
    .order("priority", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BlockagePlan[];
}

function daysSince(iso: string): number {
  const start = new Date(iso);
  const diff = Math.floor((Date.now() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff);
}

/**
 * Progreso de un bloqueo activo: % de cumplimiento de sus hábitos en la ventana
 * de evaluación y si alcanza el umbral de resolución (≥90% durante 15 días).
 */
export async function getBlockageProgress(plan: BlockagePlan): Promise<BlockageProgress> {
  const { data, error } = await getSupabase().rpc("report_blockage_progress", {
    p_plan_id: plan.id,
    p_days: RESOLUTION_WINDOW_DAYS,
  });
  if (error) throw new Error(error.message);

  const habits = (data ?? []) as HabitProgress[];
  const totals = habits.reduce(
    (acc, h) => ({ completed: acc.completed + Number(h.completed), eligible: acc.eligible + Number(h.eligible) }),
    { completed: 0, eligible: 0 },
  );
  const overall_pct = totals.eligible > 0 ? Math.round((1000 * totals.completed) / totals.eligible) / 10 : 0;
  const days_tracked = Math.min(RESOLUTION_WINDOW_DAYS, daysSince(plan.started_at));
  const is_resolved = days_tracked >= RESOLUTION_WINDOW_DAYS && overall_pct >= RESOLUTION_SUCCESS_PCT;

  return { plan_id: plan.id, habits, overall_pct, days_tracked, is_resolved };
}

export async function getIncludedHabitTitles(userId: string): Promise<string[]> {
  const { data, error } = await getSupabase()
    .from("tasks")
    .select("title")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ title: string }>).map((r) => r.title);
}

export async function getEmotionalConversations(
  userId: string,
  limit = 30,
): Promise<EmotionalConversation[]> {
  const { data, error } = await getSupabase()
    .from("emotional_conversations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as EmotionalConversation[];
}

export async function getWeeklyCheckIns(
  userId: string,
  planId: string,
  limit = 12,
): Promise<WeeklyCheckIn[]> {
  const { data, error } = await getSupabase()
    .from("emotional_weekly_checkins")
    .select("*")
    .eq("user_id", userId)
    .eq("blockage_plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as WeeklyCheckIn[]).reverse();
}
