"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, X, Dumbbell, ImagePlus } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  EQUIPMENT_OPTIONS,
  EQUIPMENT_LABELS,
  EXERCISE_TYPE_OPTIONS,
  EXERCISE_TYPE_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  muscleGroupLabel,
} from "@/lib/gym/types";
import type { GymExercise } from "@/lib/gym/types";
import { createExercise, deleteExercise, updateExercise } from "@/lib/actions/gym";

export function ExerciseCatalog({
  exercises,
  userId,
}: {
  exercises: GymExercise[];
  userId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>("");
  const [editing, setEditing] = useState<GymExercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<GymExercise | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        (!muscle || e.primary_muscle_group === muscle) &&
        (!q ||
          e.name.toLowerCase().includes(q) ||
          muscleGroupLabel(e.primary_muscle_group).toLowerCase().includes(q)),
    );
  }, [exercises, query, muscle]);

  function runDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteExercise(id);
        toast.success("Ejercicio eliminado");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio…"
            className={`${inputCls} pl-9`}
          />
        </div>
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value)}
          aria-label="Filtrar por grupo muscular"
          className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
        >
          <option value="">Todos los grupos</option>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_GROUP_LABELS[m]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-[#0f1623] hover:brightness-105"
        >
          <Plus size={15} /> Nuevo
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
          Sin ejercicios para este filtro.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const own = e.user_id === userId && !e.is_global;
            return (
              <div key={e.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                {e.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={e.image_url}
                    alt={e.name}
                    className="mb-3 h-28 w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="mb-3 grid h-28 w-full place-items-center rounded-lg bg-surface-2 text-muted">
                    <Dumbbell size={24} />
                  </div>
                )}
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="font-medium leading-tight">{e.name}</h3>
                  {own && (
                    <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                      Mío
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">{muscleGroupLabel(e.primary_muscle_group)}</p>
                {e.equipment && <p className="mt-0.5 text-xs text-muted">{e.equipment}</p>}
                {e.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted">{e.description}</p>
                )}
                {own && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(e)}
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border px-2 py-1.5 text-xs text-muted hover:text-foreground"
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => setToDelete(e)}
                      className="inline-flex items-center justify-center rounded-lg border border-border px-2 py-1.5 text-xs text-[#ec4899] hover:brightness-110"
                      aria-label="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {(creating || editing) && (
        <ExerciseFormModal
          exercise={editing}
          pending={pending}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSubmit={(fd) =>
            startTransition(async () => {
              try {
                if (editing) await updateExercise(fd);
                else await createExercise(fd);
                toast.success(editing ? "Ejercicio actualizado" : "Ejercicio creado");
                setCreating(false);
                setEditing(null);
                router.refresh();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            })
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Eliminar ejercicio"
        message={`¿Eliminar "${toDelete?.name}"? Se conserva en rutinas e historial que ya lo usen.`}
        confirmLabel="Eliminar"
        danger
        onConfirm={() => toDelete && runDelete(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}

function ExerciseFormModal({
  exercise,
  pending,
  onClose,
  onSubmit,
}: {
  exercise: GymExercise | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const inputCls =
    "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground";
  const [preview, setPreview] = useState<string | null>(exercise?.image_url ?? null);

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <form
        action={onSubmit}
        className="scroll-thin flex max-h-[88vh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl border border-border bg-surface p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">
            {exercise ? "Editar ejercicio" : "Nuevo ejercicio"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {exercise && <input type="hidden" name="id" value={exercise.id} />}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Nombre *</label>
            <input name="name" required defaultValue={exercise?.name ?? ""} className={inputCls} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grupo muscular *</label>
            <select
              name="primary_muscle_group"
              required
              defaultValue={exercise?.primary_muscle_group ?? "pecho"}
              className={inputCls}
            >
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_GROUP_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Equipo</label>
              <select
                name="equipment"
                defaultValue={exercise?.equipment ?? ""}
                className={inputCls}
              >
                <option value="">—</option>
                {EQUIPMENT_OPTIONS.map((eq) => (
                  <option key={eq} value={eq}>
                    {EQUIPMENT_LABELS[eq]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Tipo</label>
              <select
                name="exercise_type"
                defaultValue={exercise?.exercise_type ?? ""}
                className={inputCls}
              >
                <option value="">—</option>
                {EXERCISE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {EXERCISE_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Imagen</label>
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2 p-3 hover:border-accent/40">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Vista previa" className="h-16 w-16 rounded-lg object-cover" />
              ) : (
                <span className="grid h-16 w-16 place-items-center rounded-lg bg-surface text-muted">
                  <ImagePlus size={22} />
                </span>
              )}
              <span className="text-sm text-muted">
                {preview ? "Cambiar imagen" : "Subir una imagen"}
                <span className="mt-0.5 block text-xs">JPG/PNG · se sube al guardar</span>
              </span>
              <input
                name="image"
                type="file"
                accept="image/*"
                onChange={onPickImage}
                className="hidden"
              />
            </label>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Descripción</label>
            <textarea
              name="description"
              rows={2}
              defaultValue={exercise?.description ?? ""}
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Instrucciones</label>
            <textarea
              name="instructions"
              rows={2}
              defaultValue={exercise?.instructions ?? ""}
              className={inputCls}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
