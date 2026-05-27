import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/SetupNotice";
import {
  CaloriesTrend,
  DailyCaloriesBars,
  DailyMacrosStack,
  QualityTrend,
  WeeklyMacros,
} from "@/components/nutrition/ProgressCharts";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import {
  getActiveNutritionGoal,
  getDailySummariesInRange,
  getNutritionProfileByUserId,
} from "@/lib/queries/nutrition";
import { todayKey, addDays, weekRange, parseKey } from "@/lib/date";

export const dynamic = "force-dynamic";

/** Clave de la semana ISO (lunes) que contiene una fecha — para agrupar. */
function weekKey(date: string): string {
  return weekRange(date).start;
}

export default async function ProgressPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  if (!profile || !profile.onboarding_completed) redirect("/nutricion/onboarding");

  const today = todayKey(session.timeZone);
  const start = addDays(today, -29); // últimos 30 días
  const [goal, summaries] = await Promise.all([
    getActiveNutritionGoal(session.userId),
    getDailySummariesInRange(session.userId, start, today),
  ]);

  const withMeals = summaries.filter((s) => s.meals_count > 0);
  const calGoal = goal?.daily_calories ?? 0;

  // Datos para gráficos.
  const trend = summaries.map((s) => ({ date: s.summary_date, calories: s.total_calories }));
  const dailyMacros = summaries.map((s) => ({
    date: s.summary_date,
    protein: Math.round(Number(s.total_protein_g)),
    carbs: Math.round(Number(s.total_carbs_g)),
    fat: Math.round(Number(s.total_fat_g)),
  }));
  const qualityTrend = summaries.map((s) => ({
    date: s.summary_date,
    quality: s.avg_quality_score == null ? null : Math.round(Number(s.avg_quality_score)),
  }));

  const weekMap = new Map<string, { p: number; c: number; f: number; n: number }>();
  for (const s of withMeals) {
    const k = weekKey(s.summary_date);
    const acc = weekMap.get(k) ?? { p: 0, c: 0, f: 0, n: 0 };
    acc.p += Number(s.total_protein_g);
    acc.c += Number(s.total_carbs_g);
    acc.f += Number(s.total_fat_g);
    acc.n += 1;
    weekMap.set(k, acc);
  }
  const weeklyMacros = [...weekMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([k, v]) => ({
      week: `${parseKey(k).getDate()} ${new Intl.DateTimeFormat("es", { month: "short" }).format(parseKey(k))}`,
      protein: Math.round(v.p / v.n),
      carbs: Math.round(v.c / v.n),
      fat: Math.round(v.f / v.n),
    }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Tu progreso</h1>
      <p className="mb-5 text-sm text-muted">Gráficas de los últimos 30 días.</p>

      {withMeals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          Registra comidas para ver tu progreso aquí.
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold">Evolución de calorías (diaria)</h2>
              <CaloriesTrend data={trend} goal={calGoal} />
            </div>
            <div className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold">Calorías por día vs meta</h2>
              <DailyCaloriesBars data={trend} goal={calGoal} />
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold">Macros diarios</h2>
              <DailyMacrosStack data={dailyMacros} />
            </div>
            <div className="rounded-3xl border border-border bg-surface p-5">
              <h2 className="mb-3 text-sm font-semibold">Promedio de macros por semana</h2>
              <WeeklyMacros data={weeklyMacros} />
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-sm font-semibold">Calidad nutricional</h2>
            <QualityTrend data={qualityTrend} />
          </div>
        </div>
      )}
    </div>
  );
}
