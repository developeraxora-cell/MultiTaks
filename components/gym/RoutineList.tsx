"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dumbbell,
  Eye,
  Pencil,
  Trash2,
  Play,
  Power,
  Clock,
  Target,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { difficultyLabel } from "@/lib/gym/types";
import type { GymRoutine } from "@/lib/gym/types";
import {
  deleteRoutine,
  startWorkoutFromRoutine,
  toggleRoutineActive,
} from "@/lib/actions/gym";

export function RoutineList({ routines }: { routines: GymRoutine[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<GymRoutine | null>(null);

  if (routines.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-10 text-center">
        <Dumbbell size={28} className="mx-auto mb-3 text-muted" />
        <p className="text-sm text-muted">Aún no tienes rutinas.</p>
        <Link
          href="/gimnasio/rutinas/nueva"
          className="mt-4 inline-flex rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-[#0f1623] hover:brightness-105"
        >
          Crear primera rutina
        </Link>
      </div>
    );
  }

  function runStart(id: string) {
    startTransition(async () => {
      try {
        await startWorkoutFromRoutine(id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo iniciar");
      }
    });
  }

  function runToggle(r: GymRoutine) {
    startTransition(async () => {
      try {
        await toggleRoutineActive(r.id, !r.is_active);
        toast.success(r.is_active ? "Rutina desactivada" : "Rutina activada");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  function runDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteRoutine(id);
        toast.success("Rutina eliminada");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {routines.map((r) => (
          <div
            key={r.id}
            className={`flex flex-col rounded-2xl border border-border bg-surface p-5 ${
              r.is_active ? "" : "opacity-60"
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <h3 className="font-semibold leading-tight">{r.name}</h3>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                  r.is_active
                    ? "bg-accent/15 text-accent"
                    : "bg-surface-2 text-muted"
                }`}
              >
                {r.is_active ? "Activa" : "Inactiva"}
              </span>
            </div>

            {r.description && (
              <p className="mb-2 line-clamp-2 text-sm text-muted">{r.description}</p>
            )}

            <div className="mb-4 mt-auto flex flex-wrap gap-3 pt-2 text-xs text-muted">
              {r.objective && (
                <span className="inline-flex items-center gap-1">
                  <Target size={13} /> {r.objective}
                </span>
              )}
              {r.difficulty_level && (
                <span className="inline-flex items-center gap-1">
                  {difficultyLabel(r.difficulty_level)}
                </span>
              )}
              {r.estimated_duration_minutes != null && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={13} /> {r.estimated_duration_minutes} min
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || !r.is_active}
                onClick={() => runStart(r.id)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50"
              >
                <Play size={15} /> Entrenar
              </button>
              <Link
                href={`/gimnasio/rutinas/${r.id}`}
                className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 text-sm text-muted hover:text-foreground"
                aria-label="Ver"
              >
                <Eye size={15} />
              </Link>
              <Link
                href={`/gimnasio/rutinas/${r.id}/editar`}
                className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 text-sm text-muted hover:text-foreground"
                aria-label="Editar"
              >
                <Pencil size={15} />
              </Link>
              <button
                type="button"
                disabled={pending}
                onClick={() => runToggle(r)}
                className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 text-sm text-muted hover:text-foreground disabled:opacity-50"
                aria-label={r.is_active ? "Desactivar" : "Activar"}
              >
                <Power size={15} />
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => setToDelete(r)}
                className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2.5 text-sm text-[#ec4899] hover:brightness-110 disabled:opacity-50"
                aria-label="Eliminar"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar rutina"
        message={`¿Eliminar "${toDelete?.name}"? El historial de entrenamientos se conserva.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => toDelete && runDelete(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
