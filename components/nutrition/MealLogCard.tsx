"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flame, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";

import { deleteMealLog, updateMealLog } from "@/lib/actions/nutrition";
import {
  MEAL_TYPE_LABELS,
  QUALITY_LABELS,
  type MealLog,
  type MealType,
  type NutritionQuality,
} from "@/lib/nutrition/types";
import { QUALITY_BG, fmtNum } from "@/lib/nutrition/format";

export function MealLogCard({ meal, showDate = false }: { meal: MealLog; showDate?: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const time = new Date(meal.logged_at).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateLabel = new Date(meal.logged_at).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
  });
  const quality = meal.nutrition_quality as NutritionQuality | null;

  function onDelete() {
    if (!confirm(`¿Eliminar "${meal.meal_name}"? No se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteMealLog(meal.id);
        toast.success("Comida eliminada");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al eliminar");
      }
    });
  }

  function onSave(fd: FormData) {
    fd.set("id", meal.id);
    startTransition(async () => {
      try {
        await updateMealLog(fd);
        toast.success("Comida actualizada");
        setEditing(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  if (editing) {
    return (
      <form
        action={onSave}
        className="rounded-2xl border border-emerald-400/40 bg-surface p-4 space-y-3"
      >
        <input
          name="meal_name"
          defaultValue={meal.meal_name}
          required
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm font-medium"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <select name="meal_type" defaultValue={meal.meal_type ?? ""} className="rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm">
            <option value="">Tipo…</option>
            {Object.entries(MEAL_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <LabeledNum name="calories" label="kcal" value={meal.calories} />
          <LabeledNum name="protein_g" label="Prot (g)" value={meal.protein_g} />
          <LabeledNum name="carbs_g" label="Carbs (g)" value={meal.carbs_g} />
          <LabeledNum name="fat_g" label="Grasa (g)" value={meal.fat_g} />
          <LabeledNum name="fiber_g" label="Fibra (g)" value={meal.fiber_g} />
        </div>
        <input
          name="portion_estimate"
          defaultValue={meal.portion_estimate ?? ""}
          placeholder="Porción aproximada"
          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted">
            <X size={14} /> Cancelar
          </button>
          <button type="submit" disabled={pending} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-[#0f1623] disabled:opacity-60">
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Guardar
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex gap-3 rounded-2xl border border-border bg-surface p-3.5">
      {meal.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meal.image_url} alt={meal.meal_name} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="grid h-20 w-20 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted">
          <Flame size={22} />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{meal.meal_name}</p>
            <p className="text-xs text-muted">
              {meal.meal_type ? MEAL_TYPE_LABELS[meal.meal_type as MealType] : "Comida"} ·{" "}
              {showDate ? `${dateLabel} · ` : ""}{time}
              {meal.portion_estimate ? ` · ${meal.portion_estimate}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setEditing(true)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Editar">
              <Pencil size={15} />
            </button>
            <button onClick={onDelete} disabled={pending} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-red-400" aria-label="Eliminar">
              <Trash2 size={15} />
            </button>
          </div>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-semibold text-foreground">{fmtNum(meal.calories)} kcal</span>
          <span className="text-sky-300">P {fmtNum(meal.protein_g)}g</span>
          <span className="text-amber-300">C {fmtNum(meal.carbs_g)}g</span>
          <span className="text-pink-300">G {fmtNum(meal.fat_g)}g</span>
          <span className="text-emerald-300">F {fmtNum(meal.fiber_g)}g</span>
          {quality && (
            <span className={`rounded-full px-2 py-0.5 ${QUALITY_BG[quality]}`}>
              {QUALITY_LABELS[quality]}
            </span>
          )}
        </div>

        {meal.ai_recommendation && (
          <p className="mt-1.5 line-clamp-2 text-xs text-muted">💡 {meal.ai_recommendation}</p>
        )}
      </div>
    </div>
  );
}

function LabeledNum({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] text-muted">{label}</span>
      <input
        name={name}
        type="number"
        step="0.1"
        defaultValue={value}
        className="w-full rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-sm"
      />
    </label>
  );
}
