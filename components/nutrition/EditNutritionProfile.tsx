"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, Sparkles, Loader2 } from "lucide-react";

import { regenerateNutritionGoals, updateNutritionProfile } from "@/lib/actions/nutrition";
import {
  ACTIVITY_LEVEL_LABELS,
  FOOD_STYLE_LABELS,
  INTENSITY_LABELS,
  MAIN_GOAL_LABELS,
  SEX_LABELS,
  type NutritionGoal,
  type NutritionProfile,
} from "@/lib/nutrition/types";
import { fmtNum } from "@/lib/nutrition/format";
import {
  AVOID_FOOD_OPTIONS,
  DISLIKED_FOOD_OPTIONS,
  FAVORITE_FOOD_OPTIONS,
  FREQUENT_FOOD_OPTIONS,
} from "@/lib/nutrition/catalogs";
import {
  CollapsibleChips,
  CountrySelect,
  MealTimesField,
  MultiOptionCards,
  NumberField,
  SelectField,
  TextArea,
} from "./OnboardingFields";

function optList(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function EditNutritionProfile({
  profile,
  goal,
}: {
  profile: NutritionProfile;
  goal: NutritionGoal | null;
}) {
  const router = useRouter();
  const [f, setF] = useState<Record<string, string>>({
    age: s(profile.age),
    sex: s(profile.sex),
    weight_kg: s(profile.weight_kg),
    height_cm: s(profile.height_cm),
    country: s(profile.country),
    meals_per_day: s(profile.meals_per_day),
    meal_times: s(profile.meal_times),
    main_goal: s(profile.main_goal),
    goal_description: s(profile.goal_description),
    activity_level: s(profile.activity_level),
    exercise_type: s(profile.exercise_type),
    exercise_days_week: s(profile.exercise_days_week),
    exercise_minutes: s(profile.exercise_minutes),
    exercise_intensity: s(profile.exercise_intensity),
    favorite_foods: s(profile.favorite_foods),
    frequent_foods: s(profile.frequent_foods),
    disliked_foods: s(profile.disliked_foods),
    avoid_foods: s(profile.avoid_foods),
    food_style: s(profile.food_style),
    allergies: s(profile.allergies),
    intolerances: s(profile.intolerances),
    dietary_restrictions: s(profile.dietary_restrictions),
    health_notes: s(profile.health_notes),
  });
  const [pending, startTransition] = useTransition();
  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  function fd(): FormData {
    const d = new FormData();
    for (const [k, v] of Object.entries(f)) d.set(k, v);
    return d;
  }

  function save() {
    startTransition(async () => {
      try {
        await updateNutritionProfile(fd());
        toast.success("Perfil actualizado");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  function regenerate() {
    startTransition(async () => {
      try {
        await regenerateNutritionGoals();
        toast.success("Metas regeneradas con IA");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al regenerar");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Metas actuales */}
      <div className="rounded-3xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Metas actuales</h2>
          <button
            type="button"
            onClick={regenerate}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-400/40 px-3 py-1.5 text-sm text-emerald-300 disabled:opacity-60"
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Regenerar con IA
          </button>
        </div>
        {goal ? (
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Meta label="Calorías" value={`${fmtNum(goal.daily_calories ?? 0)}`} />
            <Meta label="Proteínas" value={`${goal.daily_protein_g ?? 0} g`} />
            <Meta label="Carbos" value={`${goal.daily_carbs_g ?? 0} g`} />
            <Meta label="Grasas" value={`${goal.daily_fat_g ?? 0} g`} />
            <Meta label="Fibra" value={`${goal.daily_fiber_g ?? 0} g`} />
            <Meta label="Agua" value={`${goal.daily_water_l ?? 0} L`} />
            <Meta label="Verduras" value={`${goal.daily_vegetable_servings ?? 0} porc.`} />
            <Meta label="Semanal" value={`${fmtNum(goal.weekly_calories ?? 0)}`} />
          </div>
        ) : (
          <p className="text-sm text-muted">Aún no hay metas. Pulsa “Regenerar con IA”.</p>
        )}
      </div>

      {/* Formulario de perfil */}
      <div className="rounded-3xl border border-border bg-surface p-5 space-y-5">
        <Section title="Datos básicos">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Edad" value={f.age} onChange={set("age")} />
            <SelectField label="Sexo" value={f.sex} onChange={set("sex")} options={optList(SEX_LABELS)} />
            <NumberField label="Peso (kg)" value={f.weight_kg} onChange={set("weight_kg")} step="0.1" />
            <NumberField label="Estatura (cm)" value={f.height_cm} onChange={set("height_cm")} />
            <CountrySelect label="País o región" value={f.country} onChange={set("country")} />
            <NumberField label="Comidas al día" value={f.meals_per_day} onChange={set("meals_per_day")} />
            <div className="sm:col-span-2">
              <MealTimesField label="Horarios de comida" value={f.meal_times} onChange={set("meal_times")} />
            </div>
          </div>
        </Section>

        <Section title="Objetivo y actividad">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Objetivos (puedes elegir varios)</p>
              <MultiOptionCards value={f.main_goal} onChange={set("main_goal")} options={optList(MAIN_GOAL_LABELS)} columns={2} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Tipo de ejercicio</p>
              <MultiOptionCards
                value={f.exercise_type}
                onChange={set("exercise_type")}
                options={[
                  { value: "gimnasio", label: "Gimnasio" },
                  { value: "cardio", label: "Cardio" },
                  { value: "deportes", label: "Deportes" },
                  { value: "caminatas", label: "Caminatas" },
                  { value: "funcional", label: "Entrenamiento funcional" },
                  { value: "otro", label: "Otro" },
                ]}
                columns={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Nivel de actividad" value={f.activity_level} onChange={set("activity_level")} options={optList(ACTIVITY_LEVEL_LABELS)} />
              <SelectField label="Intensidad" value={f.exercise_intensity} onChange={set("exercise_intensity")} options={optList(INTENSITY_LABELS)} />
              <NumberField label="Días ejercicio / semana" value={f.exercise_days_week} onChange={set("exercise_days_week")} />
              <NumberField label="Minutos por sesión" value={f.exercise_minutes} onChange={set("exercise_minutes")} />
            </div>
            <TextArea label="Descripción de la meta" value={f.goal_description} onChange={set("goal_description")} />
          </div>
        </Section>

        <Section title="Preferencias">
          <div className="space-y-3">
            <CollapsibleChips label="Favoritas" value={f.favorite_foods} onChange={set("favorite_foods")} options={FAVORITE_FOOD_OPTIONS} />
            <CollapsibleChips label="Frecuentes" value={f.frequent_foods} onChange={set("frequent_foods")} options={FREQUENT_FOOD_OPTIONS} />
            <CollapsibleChips label="No le gustan" value={f.disliked_foods} onChange={set("disliked_foods")} options={DISLIKED_FOOD_OPTIONS} />
            <CollapsibleChips label="Evitar" value={f.avoid_foods} onChange={set("avoid_foods")} options={AVOID_FOOD_OPTIONS} />
            <div className="pt-1">
              <SelectField label="Estilo de comida" value={f.food_style} onChange={set("food_style")} options={optList(FOOD_STYLE_LABELS)} />
            </div>
          </div>
        </Section>

        <Section title="Restricciones y salud">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextArea label="Alergias" value={f.allergies} onChange={set("allergies")} />
            <TextArea label="Intolerancias" value={f.intolerances} onChange={set("intolerances")} />
            <TextArea label="Restricciones" value={f.dietary_restrictions} onChange={set("dietary_restrictions")} />
            <TextArea label="Notas de salud" value={f.health_notes} onChange={set("health_notes")} />
          </div>
        </Section>

        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-[#0f1623] disabled:opacity-60"
        >
          {pending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Guardar cambios
        </button>
        <p className="text-center text-xs text-muted">
          Tras cambiar tu perfil, pulsa “Regenerar con IA” para actualizar tus metas.
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-semibold text-emerald-300">{title}</h3>
      {children}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}
