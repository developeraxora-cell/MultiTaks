import { redirect } from "next/navigation";

import { SetupNotice } from "@/components/SetupNotice";
import { HistoryFilters } from "@/components/nutrition/HistoryFilters";
import { MealLogCard } from "@/components/nutrition/MealLogCard";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getMealLogsInRange, getNutritionProfileByUserId } from "@/lib/queries/nutrition";
import type { MealLog } from "@/lib/nutrition/types";
import { todayKey, parseKey, weekRange, monthRange } from "@/lib/date";

export const dynamic = "force-dynamic";

function resolveRange(
  range: string,
  timeZone: string,
  start?: string,
  end?: string,
): { start: string; end: string } {
  const today = todayKey(timeZone);
  const d = parseKey(today);
  switch (range) {
    case "hoy":
      return { start: today, end: today };
    case "mes":
      return monthRange(d.getFullYear(), d.getMonth());
    case "custom":
      return { start: start || today, end: end || today };
    case "semana":
    default:
      return weekRange(today);
  }
}

function groupByDate(meals: MealLog[]): [string, MealLog[]][] {
  const map = new Map<string, MealLog[]>();
  for (const m of meals) {
    const list = map.get(m.log_date) ?? [];
    list.push(m);
    map.set(m.log_date, list);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const profile = await getNutritionProfileByUserId(session.userId);
  if (!profile || !profile.onboarding_completed) redirect("/nutricion/onboarding");

  const sp = await searchParams;
  const range = sp.range ?? "semana";
  const { start, end } = resolveRange(range, session.timeZone, sp.start, sp.end);

  const meals = await getMealLogsInRange(session.userId, start, end);
  const groups = groupByDate(meals);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Historial de comidas</h1>
      <HistoryFilters start={start} end={end} />

      {meals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center text-sm text-muted">
          No hay comidas registradas en este rango.
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([date, list]) => {
            const cal = list.reduce((s, m) => s + m.calories, 0);
            const label = new Intl.DateTimeFormat("es", {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(parseKey(date));
            return (
              <div key={date}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold capitalize">{label}</h2>
                  <span className="text-xs text-muted">
                    {list.length} comida{list.length !== 1 ? "s" : ""} · {cal.toLocaleString("es")} kcal
                  </span>
                </div>
                <div className="space-y-3">
                  {list.map((m) => (
                    <MealLogCard key={m.id} meal={m} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
