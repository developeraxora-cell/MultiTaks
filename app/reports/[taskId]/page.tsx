import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SetupNotice } from "@/components/SetupNotice";
import { StatCard, ProgressBar } from "@/components/reports/StatCard";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getTask, getLogsInRange } from "@/lib/queries/tasks";
import { formatTimeRange } from "@/lib/types";
import { reportTaskPeriod } from "@/lib/reports/calc";
import {
  monthName,
  monthRange,
  parseKey,
  todayKey,
  weekRange,
  yearRange,
  addDays,
} from "@/lib/date";

export const dynamic = "force-dynamic";

const MS_DAY = 86_400_000;

function eligibleDays(start: string, end: string, today: string): number {
  const to = parseKey(end < today ? end : today);
  const diff = Math.floor((to.getTime() - parseKey(start).getTime()) / MS_DAY) + 1;
  return diff > 0 ? diff : 0;
}

export default async function TaskReportPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const { taskId } = await params;
  const task = await getTask(taskId);
  if (!task) notFound();

  const today = todayKey();
  const d = parseKey(today);
  const year = d.getFullYear();
  const monthIndex = d.getMonth();

  const wk = weekRange(today);
  const mo = monthRange(year, monthIndex);
  const yr = yearRange(year);

  const [week, month, yearR, yearLogs] = await Promise.all([
    reportTaskPeriod(taskId, wk),
    reportTaskPeriod(taskId, mo),
    reportTaskPeriod(taskId, yr),
    getLogsInRange(yr.start, yr.end, [taskId]),
  ]);

  // Fechas completadas (hasta hoy) para rachas y desglose mensual.
  const doneDates = new Set(
    yearLogs.filter((l) => l.is_completed && l.date <= today).map((l) => l.date),
  );

  // Racha actual: días consecutivos completados terminando hoy.
  let current = 0;
  for (let k = today; k >= yr.start; k = addDays(k, -1)) {
    if (doneDates.has(k)) current++;
    else break;
  }
  // Mejor racha del año.
  let best = 0;
  let run = 0;
  for (let k = yr.start; k <= today; k = addDays(k, 1)) {
    if (doneDates.has(k)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  // Desglose por mes.
  const monthly = Array.from({ length: 12 }, (_, m) => {
    const mr = monthRange(year, m);
    const elig = eligibleDays(mr.start, mr.end, today);
    let done = 0;
    for (const dt of doneDates) if (dt >= mr.start && dt <= mr.end) done++;
    return { m, pct: elig > 0 ? Math.round((1000 * done) / elig) / 10 : 0, done, elig };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> Reportes
      </Link>

      <div>
        <h1 className="text-xl font-semibold">{task.title}</h1>
        {formatTimeRange(task.start_time, task.end_time) && (
          <p className="text-sm text-accent">
            Horario: {formatTimeRange(task.start_time, task.end_time)}
          </p>
        )}
        {task.deleted_at && (
          <span className="mt-1 inline-block rounded bg-surface-2 px-2 py-0.5 text-xs text-muted">
            eliminado · historial conservado
          </span>
        )}
      </div>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="Semana" value={`${week.pct}%`} hint={`${week.completed}/${week.eligible} días`} accent="#38bdf8" />
        <StatCard label="Mes" value={`${month.pct}%`} hint={`${month.completed}/${month.eligible} días`} accent="#a855f7" />
        <StatCard label="Año" value={`${yearR.pct}%`} hint={`${yearR.completed}/${yearR.eligible} días`} accent="#ec4899" />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label="Racha actual" value={`${current} días`} accent="#facc15" />
        <StatCard label="Mejor racha" value={`${best} días`} accent="#2dd4bf" />
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-sm font-semibold">Cumplimiento por mes · {year}</h2>
        <div className="space-y-2">
          {monthly.map((row) => (
            <div key={row.m}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="capitalize">{monthName(row.m)}</span>
                <span className="text-muted">
                  {row.done}/{row.elig} · {row.pct}%
                </span>
              </div>
              <ProgressBar pct={row.pct} color="#a855f7" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
