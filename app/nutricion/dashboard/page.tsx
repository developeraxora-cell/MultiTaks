import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Droplet, Salad } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { MealLogCard } from "@/components/nutrition/MealLogCard";
import {
  DailyCaloriesCard,
  MacroProgressCard,
  StatTile,
} from "@/components/nutrition/DashboardCards";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import {
  getActiveNutritionGoal,
  getNutritionProfileByUserId,
  getTodayMealLogs,
} from "@/lib/queries/nutrition";
import { QUALITY_LABELS } from "@/lib/nutrition/types";
import { MACRO_META } from "@/lib/nutrition/format";
import { qualityFromScore } from "@/lib/nutrition/ai";
import { todayKey, parseKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  if (!profile || !profile.onboarding_completed) redirect("/nutricion/onboarding");

  const today = todayKey(session.timeZone);
  const [goal, meals] = await Promise.all([
    getActiveNutritionGoal(session.userId),
    getTodayMealLogs(session.userId, today),
  ]);

  // Totales del día (desde las comidas, evita depender de que el resumen exista).
  const totals = meals.reduce(
    (a, m) => {
      a.cal += m.calories;
      a.prot += Number(m.protein_g);
      a.carb += Number(m.carbs_g);
      a.fat += Number(m.fat_g);
      a.fib += Number(m.fiber_g);
      if (m.nutrition_quality_score != null) {
        a.qSum += m.nutrition_quality_score;
        a.qCount += 1;
      }
      return a;
    },
    { cal: 0, prot: 0, carb: 0, fat: 0, fib: 0, qSum: 0, qCount: 0 },
  );

  const dateLabel = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(parseKey(today));

  const avgScore = totals.qCount > 0 ? Math.round(totals.qSum / totals.qCount) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      {/* Saludo */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm capitalize text-muted">{dateLabel}</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">
            Hola, {session.name.split(" ")[0]} 🥗
          </h1>
        </div>
        <Link
          href="/nutricion/registrar"
          className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#0f1623] transition-opacity hover:opacity-90"
        >
          <Camera size={18} /> Registrar comida
        </Link>
      </div>

      {!goal && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Aún no tienes metas generadas.{" "}
          <Link href="/nutricion/perfil" className="underline">Genera tus metas</Link> desde tu perfil.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,320px)_1fr]">
        <DailyCaloriesCard goal={goal?.daily_calories ?? 2000} consumed={Math.round(totals.cal)} />

        <div className="space-y-5">
          <MacroProgressCard
            macros={[
              { ...MACRO_META.protein, value: totals.prot, goal: goal?.daily_protein_g ?? 0 },
              { ...MACRO_META.carbs, value: totals.carb, goal: goal?.daily_carbs_g ?? 0 },
              { ...MACRO_META.fat, value: totals.fat, goal: goal?.daily_fat_g ?? 0 },
              { ...MACRO_META.fiber, value: totals.fib, goal: goal?.daily_fiber_g ?? 0 },
            ]}
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label="Comidas hoy" value={String(meals.length)} accent="text-emerald-300" />
            <StatTile
              label="Calidad promedio"
              value={avgScore != null ? QUALITY_LABELS[qualityFromScore(avgScore)] : "—"}
              accent="text-sky-300"
            />
            <StatTile
              label="Agua objetivo"
              value={goal?.daily_water_l ? `${goal.daily_water_l} L` : "—"}
            />
          </div>
        </div>
      </div>

      {/* Recomendaciones de la meta */}
      {goal?.ai_recommendations && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
          <Salad size={18} className="mt-0.5 shrink-0 text-emerald-300" />
          <div>
            {goal.goal_summary && <p className="text-sm font-medium">{goal.goal_summary}</p>}
            <p className="mt-1 text-sm text-muted">{goal.ai_recommendations}</p>
          </div>
        </div>
      )}

      {/* Comidas de hoy */}
      <div className="mt-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Comidas de hoy</h2>
          {goal?.daily_vegetable_servings ? (
            <span className="flex items-center gap-1.5 text-xs text-muted">
              <Droplet size={13} /> Verduras objetivo: {goal.daily_vegetable_servings} porciones
            </span>
          ) : null}
        </div>

        {meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
            <p className="text-sm text-muted">Aún no has registrado comidas hoy.</p>
            <Link
              href="/nutricion/registrar"
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-[#0f1623]"
            >
              <Camera size={16} /> Registrar la primera
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {meals.map((m) => (
              <MealLogCard key={m.id} meal={m} />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
