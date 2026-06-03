"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  Flame,
  Dumbbell,
  Trash2,
  ChevronRight,
  History,
  Sparkles,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { WORKOUT_STATUS_LABELS } from "@/lib/gym/types";
import type { GymWorkoutSession } from "@/lib/gym/types";
import { deleteWorkout } from "@/lib/actions/gym";

const STATUS_STYLES: Record<string, string> = {
  completed: "bg-accent/15 text-accent",
  in_progress: "bg-amber-500/15 text-amber-300",
  cancelled: "bg-surface-2 text-muted",
};

export function HistoryList({
  sessions,
  exerciseCounts,
  aiSummaries = {},
}: {
  sessions: GymWorkoutSession[];
  exerciseCounts: Record<string, number>;
  aiSummaries?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<GymWorkoutSession | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-10 text-center">
        <History size={28} className="mx-auto mb-3 text-muted" />
        <p className="text-sm text-muted">Todavía no hay entrenamientos registrados.</p>
      </div>
    );
  }

  function runDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteWorkout(id);
        toast.success("Entrenamiento eliminado");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <>
      <div className="space-y-3">
        {sessions.map((s) => {
          const dateLabel = new Intl.DateTimeFormat("es", {
            weekday: "short",
            day: "numeric",
            month: "short",
          }).format(new Date(`${s.session_date}T00:00:00`));
          const href =
            s.status === "in_progress"
              ? `/gimnasio/entrenar/${s.id}`
              : `/gimnasio/historial/${s.id}`;
          return (
            <div
              key={s.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <Link href={href} className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <h3 className="truncate font-semibold">
                    {s.routine_name ?? "Entrenamiento libre"}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
                      STATUS_STYLES[s.status] ?? "bg-surface-2 text-muted"
                    }`}
                  >
                    {WORKOUT_STATUS_LABELS[s.status]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1 capitalize">
                    <Calendar size={13} /> {dateLabel}
                  </span>
                  {s.duration_minutes != null && (
                    <span className="inline-flex items-center gap-1">
                      <Clock size={13} /> {s.duration_minutes} min
                    </span>
                  )}
                  {s.overall_effort != null && (
                    <span className="inline-flex items-center gap-1">
                      <Flame size={13} /> {s.overall_effort}/10
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Dumbbell size={13} /> {exerciseCounts[s.id] ?? 0} ejercicios
                  </span>
                </div>
                {aiSummaries[s.id] && (
                  <p className="mt-2 line-clamp-2 flex items-start gap-1.5 text-xs text-muted">
                    <Sparkles size={13} className="mt-0.5 shrink-0 text-accent" />
                    {aiSummaries[s.id]}
                  </p>
                )}
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => setToDelete(s)}
                className="rounded-lg border border-border p-2 text-[#ec4899] hover:brightness-110 disabled:opacity-50"
                aria-label="Eliminar"
              >
                <Trash2 size={15} />
              </button>
              <Link
                href={href}
                className="rounded-lg p-1 text-muted hover:text-foreground"
                aria-label="Ver detalle"
              >
                <ChevronRight size={18} />
              </Link>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar entrenamiento"
        message="¿Eliminar este entrenamiento del historial? No se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => toDelete && runDelete(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
