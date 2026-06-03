"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Check,
  CheckCircle2,
  Circle,
  Flag,
  X,
  Search,
  Dumbbell,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CircularTimer } from "@/components/gym/CircularTimer";
import { muscleGroupLabel } from "@/lib/gym/types";
import type {
  GymExercise,
  GymWorkoutExerciseLogWithSets,
  GymWorkoutSessionWithLogs,
  GymWorkoutSetLog,
} from "@/lib/gym/types";
import { exerciseVolume, sessionSummary } from "@/lib/gym/calc";
import {
  addExerciseToSession,
  addSet,
  cancelWorkout,
  deleteSet,
  finishWorkout,
  removeExerciseFromSession,
  toggleExerciseLogComplete,
  updateSet,
} from "@/lib/actions/gym";

export function WorkoutSession({
  session,
  catalog,
  estimatedMinutes,
}: {
  session: GymWorkoutSessionWithLogs;
  catalog: GymExercise[];
  estimatedMinutes: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [picker, setPicker] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const summary = useMemo(
    () => sessionSummary(session.exercise_logs),
    [session.exercise_logs],
  );

  function run(fn: () => Promise<void>, okMsg?: string) {
    startTransition(async () => {
      try {
        await fn();
        if (okMsg) toast.success(okMsg);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Cronómetro circular (deriva de started_at: no se detiene al navegar) */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <CircularTimer startedAt={session.started_at} estimatedMinutes={estimatedMinutes} />
      </div>

      {/* Resumen vivo */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-4 text-center">
        <Stat label="Volumen" value={`${Math.round(summary.totalVolume)} kg`} />
        <Stat label="Series" value={summary.completedSets} />
        <Stat label="Reps" value={summary.totalReps} />
      </div>

      {session.exercise_logs.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Sin ejercicios todavía. Agrega uno para empezar.
        </p>
      )}

      {session.exercise_logs.map((log) => (
        <ExerciseBlock
          key={log.id}
          log={log}
          pending={pending}
          onAddSet={() => run(() => addSet(log.id))}
          onToggleComplete={() =>
            run(() => toggleExerciseLogComplete(log.id, !log.is_completed))
          }
          onRemove={() => run(() => removeExerciseFromSession(log.id), "Ejercicio quitado")}
          onSaved={() => router.refresh()}
        />
      ))}

      <button
        type="button"
        onClick={() => setPicker(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3.5 text-sm font-medium text-muted hover:border-accent/40 hover:text-foreground"
      >
        <Plus size={16} /> Agregar ejercicio
      </button>

      {/* Barra de acciones fija */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 backdrop-blur lg:pl-64">
        <div className="mx-auto flex max-w-3xl gap-2">
          <button
            type="button"
            onClick={() => setCancelOpen(true)}
            className="rounded-xl border border-border px-4 py-3 text-sm text-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => setFinishOpen(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-[#0f1623] hover:brightness-105"
          >
            <Flag size={16} /> Finalizar entrenamiento
          </button>
        </div>
      </div>

      {picker && (
        <ExercisePicker
          catalog={catalog}
          pending={pending}
          onClose={() => setPicker(false)}
          onPick={(id) => {
            setPicker(false);
            run(() => addExerciseToSession(session.id, id), "Ejercicio agregado");
          }}
        />
      )}

      {finishOpen && (
        <FinishModal
          sessionId={session.id}
          pending={pending}
          onClose={() => setFinishOpen(false)}
          onSubmit={(fd) =>
            startTransition(async () => {
              try {
                await finishWorkout(fd);
              } catch (e) {
                if (isRedirect(e)) return;
                toast.error(e instanceof Error ? e.message : "Error");
              }
            })
          }
        />
      )}

      <ConfirmDialog
        open={cancelOpen}
        title="Cancelar entrenamiento"
        message="¿Cancelar esta sesión? Quedará marcada como cancelada en tu historial."
        confirmLabel="Cancelar sesión"
        danger
        onConfirm={() =>
          startTransition(async () => {
            try {
              await cancelWorkout(session.id);
            } catch (e) {
              if (isRedirect(e)) return;
              toast.error(e instanceof Error ? e.message : "Error");
            }
          })
        }
        onClose={() => setCancelOpen(false)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function ExerciseBlock({
  log,
  pending,
  onAddSet,
  onToggleComplete,
  onRemove,
  onSaved,
}: {
  log: GymWorkoutExerciseLogWithSets;
  pending: boolean;
  onAddSet: () => void;
  onToggleComplete: () => void;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const name = log.exercise?.name ?? log.exercise_name ?? "Ejercicio";
  const objective = [
    log.target_sets != null ? `${log.target_sets} series` : null,
    log.target_reps != null ? `${log.target_reps} reps` : null,
    log.target_weight != null ? `${log.target_weight} kg` : null,
  ]
    .filter(Boolean)
    .join(" × ");

  return (
    <div
      className={`rounded-2xl border bg-surface p-4 ${
        log.is_completed ? "border-accent/40" : "border-border"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{name}</h3>
          <p className="text-xs text-muted">
            {log.exercise ? muscleGroupLabel(log.exercise.primary_muscle_group) : ""}
            {objective ? ` · Objetivo: ${objective}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onToggleComplete}
            disabled={pending}
            className={`rounded-lg border p-1.5 ${
              log.is_completed
                ? "border-accent/40 text-accent"
                : "border-border text-muted hover:text-foreground"
            }`}
            aria-label="Marcar completado"
          >
            {log.is_completed ? <CheckCircle2 size={16} /> : <Circle size={16} />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="rounded-lg border border-border p-1.5 text-[#ec4899] hover:brightness-110"
            aria-label="Quitar ejercicio"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Cabecera de columnas */}
      <div className="mb-1 grid grid-cols-[2rem_1fr_1fr_3rem_2rem] items-center gap-2 px-1 text-[11px] text-muted">
        <span>#</span>
        <span>Peso</span>
        <span>Reps</span>
        <span>RPE</span>
        <span />
      </div>

      <div className="space-y-1.5">
        {log.sets.map((set) => (
          <SetRow
            key={set.id}
            set={set}
            exerciseLogId={log.id}
            pending={pending}
            onSaved={onSaved}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onAddSet}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
        >
          <Plus size={14} /> Agregar serie
        </button>
        <span className="text-xs text-muted">
          Volumen: {Math.round(exerciseVolume(log))} kg
        </span>
      </div>
    </div>
  );
}

function SetRow({
  set,
  exerciseLogId,
  pending,
  onSaved,
}: {
  set: GymWorkoutSetLog;
  exerciseLogId: string;
  pending: boolean;
  onSaved: () => void;
}) {
  const [weight, setWeight] = useState(set.actual_weight?.toString() ?? "");
  const [reps, setReps] = useState(set.actual_reps?.toString() ?? "");
  const [effort, setEffort] = useState(set.effort_level?.toString() ?? "");
  const [completed, setCompleted] = useState(set.completed);
  const [saving, setSaving] = useState(false);

  async function save(nextCompleted = completed) {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("id", set.id);
      fd.set("exercise_log_id", exerciseLogId);
      fd.set("actual_weight", weight);
      fd.set("actual_reps", reps);
      fd.set("weight_unit", set.weight_unit || "kg");
      fd.set("effort_level", effort);
      fd.set("completed", String(nextCompleted));
      fd.set("notes", set.notes ?? "");
      await updateSet(fd);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la serie");
    } finally {
      setSaving(false);
    }
  }

  function toggle() {
    const next = !completed;
    setCompleted(next);
    void save(next);
  }

  const cell =
    "w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-center text-sm text-foreground";

  return (
    <div
      className={`grid grid-cols-[2rem_1fr_1fr_3rem_2rem] items-center gap-2 rounded-lg p-1 ${
        completed ? "bg-accent/5" : ""
      }`}
    >
      <span className="text-center text-sm font-medium text-muted">{set.set_number}</span>
      <input
        inputMode="decimal"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => save()}
        placeholder={set.target_weight?.toString() ?? "—"}
        className={cell}
        aria-label={`Peso serie ${set.set_number}`}
      />
      <input
        inputMode="numeric"
        value={reps}
        onChange={(e) => setReps(e.target.value)}
        onBlur={() => save()}
        placeholder={set.target_reps?.toString() ?? "—"}
        className={cell}
        aria-label={`Reps serie ${set.set_number}`}
      />
      <input
        inputMode="numeric"
        value={effort}
        onChange={(e) => setEffort(e.target.value)}
        onBlur={() => save()}
        placeholder="1-10"
        className={cell}
        aria-label={`Esfuerzo serie ${set.set_number}`}
      />
      <div className="flex justify-center gap-0.5">
        <button
          type="button"
          onClick={toggle}
          disabled={saving || pending}
          className={`rounded-md border p-1.5 ${
            completed
              ? "border-accent/40 bg-accent/15 text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
          aria-label="Serie completada"
        >
          <Check size={14} />
        </button>
      </div>
      <div className="col-span-5 flex justify-end">
        <button
          type="button"
          onClick={() => deleteSet(set.id, exerciseLogId).then(onSaved)}
          className="text-[11px] text-muted hover:text-[#ec4899]"
        >
          quitar serie
        </button>
      </div>
    </div>
  );
}

function ExercisePicker({
  catalog,
  pending,
  onClose,
  onPick,
}: {
  catalog: GymExercise[];
  pending: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return catalog.filter(
      (e) =>
        !s ||
        e.name.toLowerCase().includes(s) ||
        muscleGroupLabel(e.primary_muscle_group).toLowerCase().includes(s),
    );
  }, [catalog, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-surface sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="font-semibold">Agregar ejercicio</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 pl-9 text-sm text-foreground"
            />
          </div>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-4 pb-4">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Sin resultados.</p>
          )}
          <ul className="space-y-1">
            {filtered.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onPick(e.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2.5 text-left text-sm hover:border-accent/40 hover:bg-surface-2 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-2">
                    <Dumbbell size={14} className="text-muted" /> {e.name}
                  </span>
                  <span className="text-xs text-muted">
                    {muscleGroupLabel(e.primary_muscle_group)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FinishModal({
  sessionId,
  pending,
  onClose,
  onSubmit,
}: {
  sessionId: string;
  pending: boolean;
  onClose: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  const [effort, setEffort] = useState(7);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <form
        action={onSubmit}
        className="w-full max-w-md rounded-t-2xl border border-border bg-surface p-5 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Finalizar entrenamiento</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:text-foreground"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>
        <input type="hidden" name="id" value={sessionId} />
        <input type="hidden" name="overall_effort" value={effort} />

        <label className="mb-1 block text-sm font-medium">
          Esfuerzo general: <span className="text-accent">{effort}/10</span>
        </label>
        <input
          type="range"
          min={1}
          max={10}
          value={effort}
          onChange={(e) => setEffort(Number(e.target.value))}
          className="mb-4 w-full accent-[var(--accent)]"
        />

        <label className="mb-1 block text-sm font-medium">Notas</label>
        <textarea
          name="notes"
          rows={3}
          placeholder="¿Cómo te sentiste? (opcional)"
          className="mb-4 w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground"
          >
            Volver
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50"
          >
            {pending ? "Guardando…" : "Finalizar"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** redirect() lanza un error especial de Next; no es un fallo real. */
function isRedirect(e: unknown): boolean {
  if (e instanceof Error && e.message === "NEXT_REDIRECT") return true;
  const digest = (e as { digest?: string })?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
