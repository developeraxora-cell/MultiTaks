import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";
import { StatCard, ProgressBar } from "@/components/reports/StatCard";
import { RankingChart } from "@/components/reports/RankingChart";
import { ProductivityChart } from "@/components/reports/ProductivityChart";
import { PageHeader } from "@/components/ui/PageHeader";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import {
  reportOverall,
  reportTaskRanking,
  reportDayProductivity,
  computeStreaks,
  bestAndWorstDay,
} from "@/lib/reports/calc";
import { monthName, monthRange, todayKey, weekRange, yearRange, parseKey } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const uid = session.userId;
  const today = todayKey();
  const d = parseKey(today);
  const year = d.getFullYear();
  const monthIndex = d.getMonth();

  const wk = weekRange(today);
  const mo = monthRange(year, monthIndex);
  const yr = yearRange(year);

  const [day, week, month, yearOverall, ranking, dayProd] = await Promise.all([
    reportOverall(uid, { start: today, end: today }),
    reportOverall(uid, wk),
    reportOverall(uid, mo),
    reportOverall(uid, yr),
    reportTaskRanking(uid, mo),
    reportDayProductivity(uid, yr),
  ]);

  const streaks = computeStreaks(dayProd);
  const { best, worst } = bestAndWorstDay(dayProd);
  const mostDone = ranking[0];
  const leastDone = ranking[ranking.length - 1];
  const monthDays = dayProd.filter((p) => p.d >= mo.start && p.d <= mo.end);

  const fmtDay = (key: string) => {
    const dt = parseKey(key);
    return `${dt.getDate()} ${monthName(dt.getMonth())}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
      <PageHeader title="Reportes" subtitle="Tu cumplimiento por periodo" />

      {/* Cumplimiento general por periodo */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">Cumplimiento general</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Hoy" value={`${day.pct}%`} hint={`${day.completed}/${day.possible}`} accent="#2dd4bf" />
          <StatCard label="Semana" value={`${week.pct}%`} hint={`${week.completed}/${week.possible}`} accent="#38bdf8" />
          <StatCard label="Mes" value={`${month.pct}%`} hint={`${month.completed}/${month.possible}`} accent="#a855f7" />
          <StatCard label="Año" value={`${yearOverall.pct}%`} hint={`${yearOverall.completed}/${yearOverall.possible}`} accent="#ec4899" />
        </div>
      </section>

      {/* Rachas y días destacados */}
      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Racha actual" value={`${streaks.current} días`} hint="días al 100%" accent="#facc15" />
        <StatCard label="Mejor racha" value={`${streaks.best} días`} hint="récord del año" accent="#2dd4bf" />
        <StatCard
          label="Día más productivo"
          value={best ? `${best.pct}%` : "—"}
          hint={best ? fmtDay(best.d) : "sin datos"}
        />
        <StatCard
          label="Día menos productivo"
          value={worst ? `${worst.pct}%` : "—"}
          hint={worst ? fmtDay(worst.d) : "sin datos"}
        />
      </section>

      {/* Productividad por día (mes actual) */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-2 text-sm font-semibold">
          Productividad diaria · {monthName(monthIndex)} {year}
        </h2>
        <ProductivityChart data={monthDays.map((p) => ({ d: p.d, pct: p.pct }))} />
      </section>

      {/* Ranking de hábitos (mes) */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Cumplimiento por hábito · {monthName(monthIndex)}</h2>
          {mostDone && leastDone && (
            <div className="text-xs text-muted">
              <span className="text-accent">↑ {mostDone.title}</span> ·{" "}
              <span className="text-[#ec4899]">↓ {leastDone.title}</span>
            </div>
          )}
        </div>
        <RankingChart data={ranking.map((r) => ({ title: r.title, pct: r.pct }))} />
        <div className="mt-4 space-y-2">
          {ranking.map((r) => (
            <Link
              key={r.task_id}
              href={`/reports/${r.task_id}`}
              className="block rounded-lg p-2 hover:bg-surface-2"
            >
              <div className="mb-1 flex justify-between text-xs">
                <span>{r.title}</span>
                <span className="text-muted">
                  {r.completed}/{r.eligible} · {r.pct}%
                </span>
              </div>
              <ProgressBar pct={r.pct} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
