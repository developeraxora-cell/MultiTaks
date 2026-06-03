"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, ChevronUp, ChevronDown, X } from "lucide-react";

import {
  DIFFICULTY_LABELS,
  MUSCLE_GROUP_LABELS,
  muscleGroupLabel,
} from "@/lib/gym/types";
import type {
  GymExercise,
  GymRoutineWithExercises,
} from "@/lib/gym/types";
import { createRoutine, updateRoutine } from "@/lib/actions/gym";

interface DraftExercise {
  exercise_id: string;
  name: string;
  muscle: string;
  target_sets: number;
  target_reps: number | null;
  target_weight: number | null;
  rest_seconds: number | null;
  notes: string;
}

export function RoutineForm({
  exercises,
  routine,
}: {
  exercises: GymExercise[];
  routine?: GymRoutineWithExercises;
}) {
  const isEdit = Boolean(routine);
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");

  const [items, setItems] = useState<DraftExercise[]>(
    () =>
      routine?.exercises.map((re) => ({
        exercise_id: re.exercise_id,
        name: re.exercise?.name ?? "Ejercicio",
        muscle: re.exercise?.primary_muscle_group ?? "",
        target_sets: re.target_sets ?? 3,
        target_reps: re.target_reps ?? re.target_reps_max ?? null,
        target_weight: re.target_weight ?? null,
        rest_seconds: re.rest_seconds ?? null,
        notes: re.notes ?? "",
      })) ?? [],
  );

  const filteredCatalog = useMemo(() => {
    const q = pickerFilter.trim().toLowerCase();
    return exercises.filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        muscleGroupLabel(e.primary_muscle_group).toLowerCase().includes(q),
    );
  }, [exercises, pickerFilter]);

  function addExercise(e: GymExercise) {
    setItems((prev) => [
      ...prev,
      {
        exercise_id: e.id,
        name: e.name,
        muscle: e.primary_muscle_group,
        target_sets: 3,
        target_reps: 10,
        target_weight: null,
        rest_seconds: 90,
        notes: "",
      },
    ]);
    setPicker(false);
    setPickerFilter("");
  }

  function patch(idx: number, partial: Partial<DraftExercise>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...partial } : it)));
  }
  function remove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }
  function move(idx: number, dir: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function submit(fd: FormData) {
    if (!String(fd.get("name") ?? "").trim()) {
      toast.error("El nombre de la rutina es obligatorio");
      return;
    }
    fd.set(
      "exercises",
      JSON.stringify(
        items.map((it) => ({
          exercise_id: it.exercise_id,
          target_sets: it.target_sets,
          target_reps: it.target_reps,
          target_weight: it.target_weight,
          rest_seconds: it.rest_seconds,
          notes: it.notes || null,
        })),
      ),
    );
    startTransition(async () => {
      try {
        if (isEdit) await updateRoutine(fd);
        else await createRoutine(fd);
        // redirige dentro de la action.
      } catch (e) {
        // redirect() lanza un error especial que NO debemos tratar como fallo.
        if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
        const digest = (e as { digest?: string })?.digest;
        if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return;
        toast.error(e instanceof Error ? e.message : "No se pudo guardar");
      }
    });
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground";
  const numCls =
    "w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-foreground";

  return (
    <form action={submit} className="space-y-6">
      {isEdit && <input type="hidden" name="id" value={routine!.id} />}

      {/* Datos de la rutina */}
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
        <div>
          <label className="mb-1 block text-sm font-medium">Nombre *</label>
          <input
            name="name"
            required
            defaultValue={routine?.name ?? ""}
            placeholder="Ej. Pecho y Tríceps"
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Descripción</label>
          <textarea
            name="description"
            rows={2}
            defaultValue={routine?.description ?? ""}
            className={inputCls}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Objetivo</label>
            <input
              name="objective"
              defaultValue={routine?.objective ?? ""}
              placeholder="Ej. Hipertrofia"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Dificultad</label>
            <select
              name="difficulty_level"
              defaultValue={routine?.difficulty_level ?? ""}
              className={inputCls}
            >
              <option value="">—</option>
              {Object.entries(DIFFICULTY_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Duración estimada (min)</label>
            <input
              name="estimated_duration_minutes"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={routine?.estimated_duration_minutes ?? ""}
              className={inputCls}
            />
          </div>
        </div>
      </div>

      {/* Ejercicios planificados */}
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ejercicios ({items.length})</h2>
          <button
            type="button"
            onClick={() => setPicker(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-[#0f1623] hover:brightness-105"
          >
            <Plus size={15} /> Agregar
          </button>
        </div>

        {items.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
            Agrega ejercicios del catálogo a esta rutina.
          </p>
        )}

        {items.map((it, idx) => (
          <div key={`${it.exercise_id}-${idx}`} className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {idx + 1}. {it.name}
                </p>
                <p className="text-xs text-muted">{muscleGroupLabel(it.muscle)}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={idx === items.length - 1}
                  className="rounded-lg border border-border p-1.5 text-muted hover:text-foreground disabled:opacity-30"
                  aria-label="Bajar"
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="rounded-lg border border-border p-1.5 text-[#ec4899] hover:brightness-110"
                  aria-label="Quitar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs text-muted">
                Series
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={it.target_sets}
                  onChange={(e) => patch(idx, { target_sets: Number(e.target.value) || 1 })}
                  className={numCls}
                />
              </label>
              <label className="text-xs text-muted">
                Reps
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={it.target_reps ?? ""}
                  onChange={(e) =>
                    patch(idx, { target_reps: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className={numCls}
                />
              </label>
              <label className="text-xs text-muted">
                Peso (kg)
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  value={it.target_weight ?? ""}
                  onChange={(e) =>
                    patch(idx, { target_weight: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className={numCls}
                />
              </label>
              <label className="text-xs text-muted">
                Descanso (s)
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={it.rest_seconds ?? ""}
                  onChange={(e) =>
                    patch(idx, { rest_seconds: e.target.value === "" ? null : Number(e.target.value) })
                  }
                  className={numCls}
                />
              </label>
            </div>
            <input
              value={it.notes}
              onChange={(e) => patch(idx, { notes: e.target.value })}
              placeholder="Notas (opcional)"
              className={`${inputCls} mt-2`}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50"
        >
          {pending ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear rutina"}
        </button>
      </div>

      {/* Selector de ejercicios */}
      {picker && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold">Elegir ejercicio</h3>
              <button
                type="button"
                onClick={() => setPicker(false)}
                className="rounded-lg p-1.5 text-muted hover:text-foreground"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <input
                autoFocus
                value={pickerFilter}
                onChange={(e) => setPickerFilter(e.target.value)}
                placeholder="Buscar ejercicio…"
                className={inputCls}
              />
            </div>
            <div className="scroll-thin flex-1 overflow-y-auto px-4 pb-4">
              {filteredCatalog.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">Sin resultados.</p>
              )}
              <ul className="space-y-1">
                {filteredCatalog.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => addExercise(e)}
                      className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:border-accent/40 hover:bg-surface-2"
                    >
                      <span>{e.name}</span>
                      <span className="text-xs text-muted">
                        {MUSCLE_GROUP_LABELS[
                          e.primary_muscle_group as keyof typeof MUSCLE_GROUP_LABELS
                        ] ?? e.primary_muscle_group}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
