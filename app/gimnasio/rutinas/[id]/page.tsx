import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Clock, Target, Dumbbell } from "lucide-react";

import { SetupNotice } from "@/components/SetupNotice";
import { StartRoutineButton } from "@/components/gym/StartRoutineButton";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/server";
import { getRoutineWithExercises } from "@/lib/queries/gym";
import { difficultyLabel, muscleGroupLabel } from "@/lib/gym/types";

export const dynamic = "force-dynamic";

function repsLabel(re: {
  target_reps: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
}): string {
  if (re.target_reps != null) return `${re.target_reps} reps`;
  if (re.target_reps_min != null && re.target_reps_max != null)
    return `${re.target_reps_min}-${re.target_reps_max} reps`;
  if (re.target_reps_max != null) return `${re.target_reps_max} reps`;
  return "—";
}

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const { id } = await params;
  const session = await requireUser();
  const routine = await getRoutineWithExercises(id, session.userId);
  if (!routine) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href="/gimnasio/rutinas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground"
      >
        <ArrowLeft size={16} /> Volver
      </Link>

      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{routine.name}</h1>
          {routine.description && (
            <p className="mt-1 text-sm text-muted">{routine.description}</p>
          )}
        </div>
        <Link
          href={`/gimnasio/rutinas/${routine.id}/editar`}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          <Pencil size={15} /> Editar
        </Link>
      </div>

      <div className="mb-5 flex flex-wrap gap-3 text-sm text-muted">
        {routine.objective && (
          <span className="inline-flex items-center gap-1">
            <Target size={14} /> {routine.objective}
          </span>
        )}
        {routine.difficulty_level && (
          <span>{difficultyLabel(routine.difficulty_level)}</span>
        )}
        {routine.estimated_duration_minutes != null && (
          <span className="inline-flex items-center gap-1">
            <Clock size={14} /> {routine.estimated_duration_minutes} min
          </span>
        )}
      </div>

      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Dumbbell size={18} /> Ejercicios ({routine.exercises.length})
      </h2>

      {routine.exercises.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
          Esta rutina aún no tiene ejercicios.{" "}
          <Link href={`/gimnasio/rutinas/${routine.id}/editar`} className="text-accent">
            Agregar
          </Link>
        </p>
      ) : (
        <div className="space-y-2">
          {routine.exercises.map((re, i) => (
            <div
              key={re.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {i + 1}. {re.exercise?.name ?? "Ejercicio"}
                </p>
                <p className="text-xs text-muted">
                  {re.exercise ? muscleGroupLabel(re.exercise.primary_muscle_group) : ""}
                  {re.notes ? ` · ${re.notes}` : ""}
                </p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="font-medium">
                  {re.target_sets} × {repsLabel(re)}
                </p>
                {re.target_weight != null && (
                  <p className="text-xs text-muted">
                    {re.target_weight} {re.target_weight_unit}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {routine.is_active && (
        <div className="mt-6">
          <StartRoutineButton routineId={routine.id} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50" />
        </div>
      )}
    </div>
  );
}
