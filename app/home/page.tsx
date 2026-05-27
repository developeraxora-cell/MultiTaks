import Link from "next/link";
import { Salad, ArrowRight } from "lucide-react";
import { SetupNotice } from "@/components/SetupNotice";
import { DailyChecklist } from "@/components/home/DailyChecklist";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { listActiveTasks, getLogsInRange } from "@/lib/queries/tasks";
import { getNutritionProfileByUserId } from "@/lib/queries/nutrition";
import { reportOverall } from "@/lib/reports/calc";
import { monthRange, parseKey, todayKey, weekRange } from "@/lib/date";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const session = await requireUser();
  const today = todayKey(session.timeZone);
  const d = parseKey(today);

  const tasks = await listActiveTasks(session.userId);
  const [logs, week, month, nutritionProfile] = await Promise.all([
    getLogsInRange(today, today, tasks.map((t) => t.id)),
    reportOverall(session.userId, weekRange(today)),
    reportOverall(session.userId, monthRange(d.getFullYear(), d.getMonth())),
    getNutritionProfileByUserId(session.userId),
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

      {/* Acceso a módulos */}
      <Link
        href={nutritionProfile?.onboarding_completed ? "/nutricion/dashboard" : "/nutricion/onboarding"}
        prefetch={false}
        className="group mb-6 flex items-center gap-4 rounded-2xl border border-border bg-linear-to-br from-emerald-500/10 to-sky-500/10 p-5 transition-colors hover:border-emerald-400/40"
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-500/20 text-emerald-300">
          <Salad size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Fitness</h2>
          <p className="text-sm text-muted">
            Registra tus comidas por foto y recibe metas y análisis nutricional con IA.
          </p>
        </div>
        <ArrowRight size={20} className="shrink-0 text-muted transition-transform group-hover:translate-x-1" />
      </Link>

      <DailyChecklist
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          category: t.category,
          start_time: t.start_time,
          end_time: t.end_time,
        }))}
        initialDone={done}
        weekPct={week.pct}
        monthPct={month.pct}
      />
    </div>
  );
}
