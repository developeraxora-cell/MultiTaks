import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Flame, Calendar, Dumbbell } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { WorkoutAnalysisPanel } from "@/components/gym/WorkoutAnalysisPanel";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getSessionWithLogs, getWorkoutAnalysis } from "@/lib/queries/gym";
import { compareWorkout, exerciseVolume, sessionSummary } from "@/lib/gym/calc";
import {
  WORKOUT_STATUS_LABELS,
  muscleGroupLabel,
  type ComparisonStatus,
} from "@/lib/gym/types";

const STATUS_BADGE: Record<ComparisonStatus, { label: string; cls: string }> = {
  cumplido: { label: "Cumplido", cls: "bg-accent/15 text-accent" },
  superado: { label: "Superado", cls: "bg-sky-500/15 text-sky-300" },
  parcial: { label: "Parcial", cls: "bg-amber-500/15 text-amber-300" },
  sin_objetivo: { label: "Libre", cls: "bg-surface-2 text-muted" },
};

export const dynamic = "force-dynamic";

export default async function HistoryDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { sessionId } = await params;
  const session = await requireUser();
  const workout = await getSessionWithLogs(sessionId, session.userId);
  if (!workout) notFound();

  const analysis = await getWorkoutAnalysis(sessionId, session.userId);
  const summary = sessionSummary(workout.exercise_logs);
  const comparison = compareWorkout(workout.exercise_logs);
  const cmpByLog = new Map(comparison.exercises.map((e) => [e.exercise_log_id, e]));
  const dateLabel = new Intl.DateTimeFormat("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${workout.session_date}T00:00:00`));

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/gimnasio/historial"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} /> Volver al historial
      </Link>

      <div className="mb-2 flex items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {workout.routine_name ?? "Entrenamiento libre"}
        </h1>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">
          {WORKOUT_STATUS_LABELS[workout.status]}
        </span>
      </div>
      <p className="mb-4 flex items-center gap-1.5 text-sm capitalize text-muted">
        <Calendar size={14} /> {dateLabel}
      </p>

      {/* Resumen */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="Volumen total" value={`${Math.round(summary.totalVolume)} kg`} />
        <SummaryTile label="Series" value={summary.completedSets} />
        <SummaryTile label="Reps" value={summary.totalReps} />
        <SummaryTile
          label="Duración"
          value={workout.duration_minutes != null ? `${workout.duration_minutes} min` : "—"}
        />
      </div>

      {workout.overall_effort != null && (
        <p className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted">
          <Flame size={14} /> Esfuerzo general: {workout.overall_effort}/10
        </p>
      )}
      {workout.notes && (
        <p className="mb-5 rounded-xl border border-border bg-surface p-3 text-sm text-muted">
          {workout.notes}
        </p>
      )}

      {/* Análisis IA: objetivo vs realizado */}
      {workout.exercise_logs.length > 0 && (
        <div className="mb-6">
          <WorkoutAnalysisPanel sessionId={workout.id} analysis={analysis} />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Dumbbell size={18} /> Ejercicios ({workout.exercise_logs.length})
        </h2>
        {comparison.overall_adherence_pct != null && (
          <span className="text-xs text-muted">
            Adherencia: {comparison.overall_adherence_pct}% del objetivo
          </span>
        )}
      </div>

      <div className="space-y-3">
        {workout.exercise_logs.map((log) => {
          const cmp = cmpByLog.get(log.id);
          const objective =
            cmp && cmp.status !== "sin_objetivo"
              ? [
                  cmp.target_sets != null ? `${cmp.target_sets} series` : null,
                  cmp.target_reps != null ? `${cmp.target_reps} reps` : null,
                  cmp.target_weight != null ? `${cmp.target_weight} kg` : null,
                ]
                  .filter(Boolean)
                  .join(" × ")
              : null;
          return (
          <div key={log.id} className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-1 flex items-start justify-between gap-2">
              <h3 className="font-medium">{log.exercise?.name ?? log.exercise_name ?? "Ejercicio"}</h3>
              <div className="flex shrink-0 items-center gap-2">
                {cmp && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_BADGE[cmp.status].cls}`}
                  >
                    {STATUS_BADGE[cmp.status].label}
                  </span>
                )}
                <span className="text-xs text-muted">{Math.round(exerciseVolume(log))} kg</span>
              </div>
            </div>
            <p className="mb-2 text-xs text-muted">
              {log.exercise ? muscleGroupLabel(log.exercise.primary_muscle_group) : ""}
              {objective ? `${log.exercise ? " · " : ""}Objetivo: ${objective}` : ""}
            </p>
            {log.sets.length === 0 ? (
              <p className="text-xs text-muted">Sin series registradas.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-muted">
                    <th className="py-1 font-normal">Serie</th>
                    <th className="py-1 font-normal">Peso</th>
                    <th className="py-1 font-normal">Reps</th>
                    <th className="py-1 font-normal">RPE</th>
                  </tr>
                </thead>
                <tbody>
                  {log.sets.map((s) => (
                    <tr key={s.id} className="border-t border-border/60">
                      <td className="py-1.5">{s.set_number}</td>
                      <td className="py-1.5">
                        {s.actual_weight != null ? `${s.actual_weight} ${s.weight_unit}` : "—"}
                      </td>
                      <td className="py-1.5">{s.actual_reps ?? "—"}</td>
                      <td className="py-1.5">{s.effort_level ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {log.notes && <p className="mt-2 text-xs text-muted">{log.notes}</p>}
          </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}
