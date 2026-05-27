import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SetupNotice } from "@/components/SetupNotice";
import { StatCard, ProgressBar } from "@/components/reports/StatCard";
import { RankingChart } from "@/components/reports/RankingChart";
import { ProductivityChart } from "@/components/reports/ProductivityChart";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { getUsuario } from "@/lib/queries/users";
import { createTask } from "@/lib/actions/tasks";
import { HABIT_CATEGORIES } from "@/lib/types";
import {
  reportOverall,
  reportTaskRanking,
  reportDayProductivity,
  computeStreaks,
  bestAndWorstDay,
} from "@/lib/reports/calc";
import { monthName, monthRange, parseKey, todayKey, weekRange, yearRange } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function MonitorDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  await requireAdmin();

  const { userId } = await params;
  const user = await getUsuario(userId);
  if (!user) notFound();

  const today = todayKey(user.time_zone);
  const d = parseKey(today);
  const year = d.getFullYear();
  const monthIndex = d.getMonth();
  const wk = weekRange(today);
  const mo = monthRange(year, monthIndex);
  const yr = yearRange(year);

  const [day, week, month, yearOverall, ranking, dayProd] = await Promise.all([
    reportOverall(userId, { start: today, end: today }),
    reportOverall(userId, wk),
    reportOverall(userId, mo),
    reportOverall(userId, yr),
    reportTaskRanking(userId, mo),
    reportDayProductivity(userId, yr),
  ]);

  const streaks = computeStreaks(dayProd);
  const { best, worst } = bestAndWorstDay(dayProd);
  const monthDays = dayProd.filter((p) => p.d >= mo.start && p.d <= mo.end);
  const fmtDay = (key: string) => {
    const dt = parseKey(key);
    return `${dt.getDate()} ${monthName(dt.getMonth())}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6">
      <Link href="/admin/monitor" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Monitoreo
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{user.full_name}</h1>
        <p className="text-sm text-muted">{user.email}</p>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Hoy" value={`${day.pct}%`} hint={`${day.completed}/${day.possible}`} accent="#2dd4bf" />
        <StatCard label="Semana" value={`${week.pct}%`} hint={`${week.completed}/${week.possible}`} accent="#38bdf8" />
        <StatCard label="Mes" value={`${month.pct}%`} hint={`${month.completed}/${month.possible}`} accent="#a855f7" />
        <StatCard label="Año" value={`${yearOverall.pct}%`} hint={`${yearOverall.completed}/${yearOverall.possible}`} accent="#ec4899" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Racha actual" value={`${streaks.current} días`} accent="#facc15" />
        <StatCard label="Mejor racha" value={`${streaks.best} días`} accent="#2dd4bf" />
        <StatCard label="Día más productivo" value={best ? `${best.pct}%` : "—"} hint={best ? fmtDay(best.d) : ""} />
        <StatCard label="Día menos productivo" value={worst ? `${worst.pct}%` : "—"} hint={worst ? fmtDay(worst.d) : ""} />
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold">Productividad diaria · {monthName(monthIndex)} {year}</h2>
        <ProductivityChart data={monthDays.map((p) => ({ d: p.d, pct: p.pct }))} />
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Cumplimiento por hábito · {monthName(monthIndex)}</h2>
        <RankingChart data={ranking.map((r) => ({ title: r.title, pct: r.pct }))} />
        <div className="mt-4 space-y-2">
          {ranking.map((r) => (
            <div key={r.task_id}>
              <div className="mb-1 flex justify-between text-xs">
                <span>{r.title}</span>
                <span className="text-muted">{r.completed}/{r.eligible} · {r.pct}%</span>
              </div>
              <ProgressBar pct={r.pct} />
            </div>
          ))}
        </div>
      </section>

      {/* Asignar tarea a este usuario */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Asignar hábito a {user.full_name}</h2>
        <form action={createTask} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="target_user_id" value={user.id} />
          <input
            name="title"
            required
            placeholder="Título del hábito"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm sm:col-span-2"
          />
          <label className="sm:col-span-2">
            <span className="mb-1 block text-xs text-muted">Tipo de hábito</span>
            <select
              name="category"
              defaultValue="desarrollo_personal"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
            >
              {HABIT_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            Desde
            <input name="start_time" type="time" className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            Hasta
            <input name="end_time" type="time" className="flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground" />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#0f1623] hover:opacity-90 sm:col-span-2"
          >
            Asignar
          </button>
        </form>
      </section>
    </div>
  );
}
