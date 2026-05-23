import { SetupNotice } from "@/components/SetupNotice";
import { DailyChecklist } from "@/components/home/DailyChecklist";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { listActiveTasks, getLogsInRange } from "@/lib/queries/tasks";
import { reportOverall } from "@/lib/reports/calc";
import { monthRange, parseKey, todayKey, weekRange } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const today = todayKey();
  const d = parseKey(today);

  const tasks = await listActiveTasks(session.userId);
  const [logs, week, month] = await Promise.all([
    getLogsInRange(today, today, tasks.map((t) => t.id)),
    reportOverall(session.userId, weekRange(today)),
    reportOverall(session.userId, monthRange(d.getFullYear(), d.getMonth())),
  ]);

  const done = logs.filter((l) => l.is_completed).map((l) => l.task_id);
  const dateLabel = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Hero */}
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-linear-to-br from-surface to-surface-2 p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
        <p className="text-sm capitalize text-muted">{dateLabel}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Hola, {session.name.split(" ")[0]} 👋
        </h1>
      </div>

      <DailyChecklist
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          start_time: t.start_time,
          end_time: t.end_time,
        }))}
        date={today}
        initialDone={done}
        weekPct={week.pct}
        monthPct={month.pct}
      />
    </div>
  );
}
