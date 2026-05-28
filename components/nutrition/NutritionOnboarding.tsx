"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Loader2,
  Salad,
  Sparkles,
} from "lucide-react";

import {
  completeNutritionOnboarding,
  saveOnboardingStep,
} from "@/lib/actions/nutrition";
import {
  ACTIVITY_LEVEL_LABELS,
  FOOD_STYLE_LABELS,
  INTENSITY_LABELS,
  MAIN_GOAL_LABELS,
  SEX_LABELS,
  type NutritionProfile,
} from "@/lib/nutrition/types";
import {
  AVOID_FOOD_OPTIONS,
  DISLIKED_FOOD_OPTIONS,
  FAVORITE_FOOD_OPTIONS,
  FREQUENT_FOOD_OPTIONS,
} from "@/lib/nutrition/catalogs";
import {
  CountrySelect,
  FoodPicker,
  MealTimesField,
  MultiOptionCards,
  NumberField,
  OptionCards,
  SelectField,
  TextArea,
} from "./OnboardingFields";

type FormState = Record<string, string>;

const STEP_TITLES = [
  "Datos básicos",
  "Tu objetivo",
  "Actividad física",
  "Comidas favoritas",
  "Comidas frecuentes",
  "Lo que no te gusta",
  "Alimentos a evitar",
  "Restricciones",
  "Confirmación",
];

function optList(labels: Record<string, string>) {
  return Object.entries(labels).map(([value, label]) => ({ value, label }));
}

/** Convierte el perfil (campos null/number) al estado de strings del formulario. */
function seed(p: NutritionProfile | null): FormState {
  const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    age: s(p?.age),
    sex: s(p?.sex),
    weight_kg: s(p?.weight_kg),
    height_cm: s(p?.height_cm),
    country: s(p?.country),
    meals_per_day: s(p?.meals_per_day),
    meal_times: s(p?.meal_times),
    main_goal: s(p?.main_goal),
    goal_description: s(p?.goal_description),
    activity_level: s(p?.activity_level),
    exercise_type: s(p?.exercise_type),
    exercise_days_week: s(p?.exercise_days_week),
    exercise_minutes: s(p?.exercise_minutes),
    exercise_intensity: s(p?.exercise_intensity),
    favorite_foods: s(p?.favorite_foods),
    frequent_foods: s(p?.frequent_foods),
    disliked_foods: s(p?.disliked_foods),
    avoid_foods: s(p?.avoid_foods),
    food_style: s(p?.food_style),
    allergies: s(p?.allergies),
    intolerances: s(p?.intolerances),
    dietary_restrictions: s(p?.dietary_restrictions),
    health_notes: s(p?.health_notes),
  };
}

function toFormData(state: FormState): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(state)) fd.set(k, v);
  return fd;
}

function csvCount(csv: string): number {
  return csv ? csv.split(",").map((s) => s.trim()).filter(Boolean).length : 0;
}

export function NutritionOnboarding({ profile }: { profile: NutritionProfile | null }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => seed(profile));
  const [step, setStep] = useState(() => Math.min(profile?.onboarding_step ?? 0, 8));
  const [generatingGoals, setGeneratingGoals] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = (key: string) => (v: string) => setForm((f) => ({ ...f, [key]: v }));

  const total = STEP_TITLES.length;
  const progress = Math.round(((step + 1) / total) * 100);

  function validateStep(targetStep = step): string | null {
    if (targetStep === 0) {
      const missing = [
        !form.age && "edad",
        !form.sex && "sexo",
        !form.weight_kg && "peso actual",
        !form.height_cm && "estatura",
        !form.country && "país o región",
        !form.meals_per_day && "comidas al día",
        !form.meal_times && "horarios habituales de comida",
      ].filter(Boolean);
      if (missing.length > 0) return `Faltan campos por completar: ${missing.join(", ")}.`;
    }
    if (targetStep === 1 && !form.main_goal) return "Falta seleccionar al menos un objetivo.";
    if (targetStep === 2) {
      const missing = [
        !form.activity_level && "nivel de actividad",
        !form.exercise_type && "tipo de ejercicio",
        form.exercise_days_week === "" && "días de ejercicio por semana",
        form.exercise_minutes === "" && "minutos por sesión",
        !form.exercise_intensity && "intensidad percibida",
      ].filter(Boolean);
      if (missing.length > 0) return `Faltan campos por completar: ${missing.join(", ")}.`;
    }
    // Paso "Comidas favoritas" es opcional.
    if (targetStep === 4 && csvCount(form.frequent_foods) < 3) {
      return "Selecciona al menos 3 alimentos que consumes con frecuencia.";
    }
    // Paso "Lo que no te gusta" es opcional (sin mínimo).
    if (targetStep === 6 && csvCount(form.avoid_foods) < 3) {
      return "Selecciona al menos 3 alimentos que quieres evitar.";
    }
    return null;
  }

  function validateAll(): { targetStep: number; message: string } | null {
    for (let targetStep = 0; targetStep <= 7; targetStep++) {
      const message = validateStep(targetStep);
      if (message) return { targetStep, message };
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) {
      toast.error(err);
      return;
    }
    const target = Math.min(step + 1, total - 1);
    // Persiste el progreso en segundo plano (permite reanudar más tarde).
    startTransition(async () => {
      try {
        await saveOnboardingStep(target, toFormData(form));
      } catch {
        /* el guardado de progreso es best-effort */
      }
    });
    setStep(target);
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  function finish() {
    const err = validateAll();
    if (err) {
      setStep(err.targetStep);
      toast.error(err.message);
      return;
    }
    setGeneratingGoals(true);
    startTransition(async () => {
      try {
        await completeNutritionOnboarding(toFormData(form));
        toast.success("¡Metas generadas! Bienvenido a tu plan.");
        router.push("/nutricion/dashboard");
        router.refresh();
      } catch (e) {
        setGeneratingGoals(false);
        toast.error(e instanceof Error ? e.message : "No se pudo completar");
      }
    });
  }

  if (generatingGoals) return <GeneratingGoalsScreen />;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
      {/* Cabecera + progreso */}
      <div className="mb-6">
        <p className="text-sm text-emerald-300">Fitness</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Paso {step + 1} de {total}: {STEP_TITLES[step]}
        </h1>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-linear-to-r from-emerald-400 to-sky-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-surface p-5 sm:p-6">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Edad" value={form.age} onChange={set("age")} min={5} max={120} placeholder="Ej. 28" />
            <SelectField label="Sexo" value={form.sex} onChange={set("sex")} options={optList(SEX_LABELS)} />
            <NumberField label="Peso actual (kg)" value={form.weight_kg} onChange={set("weight_kg")} step="0.1" placeholder="Ej. 72" />
            <NumberField label="Estatura (cm)" value={form.height_cm} onChange={set("height_cm")} placeholder="Ej. 175" />
            <CountrySelect label="País o región" value={form.country} onChange={set("country")} />
            <NumberField label="Comidas al día" value={form.meals_per_day} onChange={set("meals_per_day")} min={1} max={10} placeholder="Ej. 3" />
            <div className="sm:col-span-2">
              <MealTimesField
                label="Horarios habituales de comida"
                value={form.meal_times}
                onChange={set("meal_times")}
                hint="Agrega la hora de cada comida del día."
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium">¿Cuáles son tus objetivos? (puedes elegir varios)</p>
            <MultiOptionCards value={form.main_goal} onChange={set("main_goal")} options={optList(MAIN_GOAL_LABELS)} columns={2} />
            <TextArea
              label="Describe tu meta (opcional)"
              value={form.goal_description}
              onChange={set("goal_description")}
              placeholder="Cuéntanos con tus palabras qué quieres lograr."
              rows={3}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Nivel de actividad</p>
              <OptionCards value={form.activity_level} onChange={set("activity_level")} options={optList(ACTIVITY_LEVEL_LABELS)} columns={3} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Tipo de ejercicio (elige los que practiques)</p>
              <MultiOptionCards
                value={form.exercise_type}
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
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField label="Intensidad percibida" value={form.exercise_intensity} onChange={set("exercise_intensity")} options={optList(INTENSITY_LABELS)} />
              <NumberField label="Días / semana" value={form.exercise_days_week} onChange={set("exercise_days_week")} min={0} max={7} placeholder="Ej. 4" />
              <NumberField label="Minutos / sesión" value={form.exercise_minutes} onChange={set("exercise_minutes")} min={0} placeholder="Ej. 60" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Puedes elegir comidas que sí disfrutas para personalizar tu plan. Este paso es opcional.</p>
            <FoodPicker value={form.favorite_foods} onChange={set("favorite_foods")} options={FAVORITE_FOOD_OPTIONS} />
            <div className="pt-2">
              <SelectField label="Tipo de comida preferida (opcional)" value={form.food_style} onChange={set("food_style")} options={optList(FOOD_STYLE_LABELS)} />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Marca al menos 3 alimentos que consumes con frecuencia.</p>
            <FoodPicker value={form.frequent_foods} onChange={set("frequent_foods")} options={FREQUENT_FOOD_OPTIONS} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Marca los alimentos que prefieres no ver en tus recomendaciones <span className="text-muted/70">(opcional)</span>.</p>
            <FoodPicker value={form.disliked_foods} onChange={set("disliked_foods")} options={DISLIKED_FOOD_OPTIONS} />
          </div>
        )}

        {step === 6 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Marca al menos 3 alimentos o bebidas que quieres limitar o evitar.</p>
            <FoodPicker value={form.avoid_foods} onChange={set("avoid_foods")} options={AVOID_FOOD_OPTIONS} />
          </div>
        )}

        {step === 7 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea label="Alergias" value={form.allergies} onChange={set("allergies")} placeholder="Ej. maní, mariscos o Ninguna" />
              <TextArea label="Intolerancias" value={form.intolerances} onChange={set("intolerances")} placeholder="Ej. lactosa, gluten o Ninguna" />
            </div>
            <TextArea label="Restricciones alimentarias" value={form.dietary_restrictions} onChange={set("dietary_restrictions")} placeholder="Ej. vegetariano, sin cerdo o Ninguna" />
            <TextArea label="Notas importantes de salud" value={form.health_notes} onChange={set("health_notes")} rows={3} placeholder="Ej. gastritis, hipertensión o Ninguna" />
          </div>
        )}

        {step === 8 && (
          <Confirmation form={form} />
        )}

        {/* Navegación */}
        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={back}
            disabled={step === 0 || pending || generatingGoals}
            className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm text-muted transition-colors hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft size={16} /> Atrás
          </button>

          {step < total - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={pending || generatingGoals}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-[#0f1623] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Siguiente <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={pending || generatingGoals}
              className="flex items-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-[#0f1623] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generar mis metas con IA
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GeneratingGoalsScreen() {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background px-5">
      <div className="w-full max-w-lg text-center">
        <div className="relative mx-auto mb-7 h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-emerald-400/10 blur-xl" />
          <div className="absolute inset-4 animate-pulse rounded-full border border-emerald-300/30 bg-surface" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-emerald-300 border-r-sky-300" />
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-20 w-20 place-items-center rounded-2xl border border-border bg-surface-2 shadow-xl shadow-emerald-500/10">
              <Bot size={42} className="text-emerald-300" />
            </div>
          </div>
          <div className="absolute -right-1 top-5 rounded-xl border border-border bg-surface-2 p-2 text-sky-300">
            <Dumbbell size={18} />
          </div>
          <div className="absolute bottom-4 -left-2 rounded-xl border border-border bg-surface-2 p-2 text-emerald-300">
            <Salad size={18} />
          </div>
        </div>

        <p className="mb-2 text-sm font-medium text-emerald-300">Fitness IA</p>
        <h1 className="text-2xl font-bold tracking-tight">Generando tus metas</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted">
          Analizando tu perfil, preferencias, actividad y objetivos para preparar un plan inicial.
        </p>

        <div className="mx-auto mt-7 max-w-sm overflow-hidden rounded-full bg-surface-2">
          <div className="h-2 w-2/3 animate-pulse rounded-full bg-linear-to-r from-emerald-400 via-sky-400 to-emerald-400" />
        </div>

        <div className="mt-6 grid gap-2 text-left text-sm text-muted">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface/70 px-3 py-2">
            <Activity size={16} className="text-emerald-300" />
            Calculando calorías y macros diarios
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface/70 px-3 py-2">
            <Sparkles size={16} className="text-sky-300" />
            Ajustando recomendaciones a tus hábitos
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-surface/70 px-3 py-2">
            <Loader2 size={16} className="animate-spin text-emerald-300" />
            Activando tu dashboard de Fitness
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-border/60 py-1.5 text-sm last:border-0">
      <span className="shrink-0 text-muted">{label}</span>
      <span className="min-w-0 wrap-break-word text-right font-medium">{value}</span>
    </div>
  );
}

/** "a,b,c" → "a, b, c" (CSV legible). Vacío → "". */
function prettyCsv(csv: string): string {
  return csv
    ? csv.split(",").map((s) => s.trim()).filter(Boolean).join(", ")
    : "";
}

function Confirmation({ form }: { form: FormState }) {
  const lbl = (map: Record<string, string>, key: string) => map[form[key]] ?? form[key];
  // CSV → etiquetas legibles unidas por coma.
  const csvLbl = (map: Record<string, string>, key: string) =>
    (form[key] ? form[key].split(",") : [])
      .map((v) => map[v.trim()] ?? v.trim())
      .filter(Boolean)
      .join(", ");
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Revisa tu información antes de generar tus metas.</p>
      <div className="rounded-2xl border border-border bg-surface-2 p-4">
        <h3 className="mb-1 text-sm font-semibold text-emerald-300">Datos básicos</h3>
        <Row label="Edad" value={form.age} />
        <Row label="Sexo" value={lbl(SEX_LABELS, "sex")} />
        <Row label="Peso" value={form.weight_kg ? `${form.weight_kg} kg` : ""} />
        <Row label="Estatura" value={form.height_cm ? `${form.height_cm} cm` : ""} />
        <Row label="País" value={form.country} />
        <Row label="Comidas/día" value={form.meals_per_day} />
      </div>
      <div className="rounded-2xl border border-border bg-surface-2 p-4">
        <h3 className="mb-1 text-sm font-semibold text-emerald-300">Objetivo y actividad</h3>
        <Row label="Objetivos" value={csvLbl(MAIN_GOAL_LABELS, "main_goal")} />
        <Row label="Actividad" value={lbl(ACTIVITY_LEVEL_LABELS, "activity_level")} />
        <Row label="Días ejercicio" value={form.exercise_days_week} />
        <Row label="Intensidad" value={lbl(INTENSITY_LABELS, "exercise_intensity")} />
      </div>
      <div className="rounded-2xl border border-border bg-surface-2 p-4">
        <h3 className="mb-1 text-sm font-semibold text-emerald-300">Preferencias y restricciones</h3>
        <Row label="Estilo de comida" value={lbl(FOOD_STYLE_LABELS, "food_style")} />
        <Row label="Favoritas" value={prettyCsv(form.favorite_foods)} />
        <Row label="Frecuentes" value={prettyCsv(form.frequent_foods)} />
        <Row label="No le gustan" value={prettyCsv(form.disliked_foods)} />
        <Row label="Evitar" value={prettyCsv(form.avoid_foods)} />
        <Row label="Alergias" value={form.allergies} />
        <Row label="Intolerancias" value={form.intolerances} />
      </div>
    </div>
  );
}
