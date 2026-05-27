"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ImageIcon, Sparkles, Loader2, Check, RefreshCw } from "lucide-react";

import { analyzeMealImage, createMealLog, type AnalyzeResult } from "@/lib/actions/nutrition";
import { MEAL_TYPE_LABELS, QUALITY_LABELS, type MealAnalysis } from "@/lib/nutrition/types";
import { QUALITY_BG } from "@/lib/nutrition/format";

type Phase = "select" | "analyzing" | "review";

export function RegisterMeal({ today }: { today: string }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("select");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setResult(null);
    setPhase("select");
  }

  function analyze() {
    if (!file) {
      toast.error("Selecciona o toma una foto primero");
      return;
    }
    const fd = new FormData();
    fd.set("image", file);
    setPhase("analyzing");
    startTransition(async () => {
      try {
        const r = await analyzeMealImage(fd);
        setResult(r);
        setPhase("review");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al analizar");
        setPhase("select");
      }
    });
  }

  function reset() {
    setPhase("select");
    setResult(null);
    setFile(null);
    setPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  function save(fd: FormData) {
    if (!result) return;
    fd.set("log_date", today);
    fd.set("image_url", result.image_url ?? "");
    fd.set("image_path", result.image_path ?? "");
    fd.set("detected_foods", JSON.stringify(result.analysis.detected_foods));
    fd.set("micronutrients", JSON.stringify(result.analysis.micronutrients));
    fd.set("nutrition_quality", result.analysis.nutrition_quality);
    fd.set("nutrition_quality_score", String(result.analysis.nutrition_quality_score));
    fd.set("ai_analysis", result.analysis.ai_analysis);
    fd.set("ai_recommendation", result.analysis.ai_recommendation);
    startTransition(async () => {
      try {
        await createMealLog(fd);
        toast.success("Comida registrada");
        router.push("/nutricion/dashboard");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al guardar");
      }
    });
  }

  return (
    <div className="space-y-5 pb-24 sm:pb-0">
      {/* Imagen / selección */}
      <div className="rounded-3xl border border-border bg-surface p-5">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pickFile}
          className="hidden"
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Vista previa" className="mx-auto max-h-72 rounded-2xl object-contain" />
        ) : (
          <div className="grid place-items-center rounded-2xl border-2 border-dashed border-border bg-surface-2/40 py-12 text-center">
            <Camera size={36} className="text-muted" />
            <p className="mt-2 text-sm text-muted">Toma o sube una foto de tu plato</p>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:border-emerald-400/40"
          >
            <ImageIcon size={16} /> {preview ? "Cambiar foto" : "Cámara o galería"}
          </button>
          {phase !== "review" && (
            <button
              type="button"
              onClick={analyze}
              disabled={!file || pending}
              className="hidden items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#0f1623] disabled:opacity-50 sm:flex"
            >
              {phase === "analyzing" ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {phase === "analyzing" ? "Analizando…" : "Analizar con IA"}
            </button>
          )}
        </div>
      </div>

      {phase !== "review" && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[#0f1623]/95 p-3 shadow-2xl shadow-black/40 backdrop-blur sm:hidden">
          <button
            type="button"
            onClick={analyze}
            disabled={!file || pending}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-[#0f1623] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "analyzing" ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            {phase === "analyzing" ? "Analizando comida..." : file ? "Analizar con IA" : "Selecciona una foto"}
          </button>
        </div>
      )}

      {/* Resultado editable */}
      {phase === "review" && result && (
        <form action={save} className="rounded-3xl border border-emerald-400/30 bg-surface p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Revisa y confirma</h2>
            <span className={`rounded-full px-2.5 py-1 text-xs ${QUALITY_BG[result.analysis.nutrition_quality]}`}>
              Calidad: {QUALITY_LABELS[result.analysis.nutrition_quality]} ({result.analysis.nutrition_quality_score})
            </span>
          </div>

          {result.analysis.detected_foods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.analysis.detected_foods.map((f) => (
                <span key={f} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">{f}</span>
              ))}
            </div>
          )}

          <ReviewForm analysis={result.analysis} />

          <div className="rounded-xl bg-surface-2 p-3 text-sm">
            <p className="text-muted">{result.analysis.ai_analysis}</p>
            <p className="mt-1.5 text-emerald-300">💡 {result.analysis.ai_recommendation}</p>
          </div>

          <div className="flex gap-2">
            <button type="button" onClick={reset} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm text-muted">
              <RefreshCw size={15} /> Descartar
            </button>
            <button type="submit" disabled={pending} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-[#0f1623] disabled:opacity-60">
              {pending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Guardar comida
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Campos editables del análisis antes de guardar. */
function ReviewForm({ analysis }: { analysis: MealAnalysis }) {
  return (
    <div className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Nombre de la comida</span>
        <input
          name="meal_name"
          defaultValue={analysis.meal_name}
          required
          className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Tipo</span>
          <select name="meal_type" defaultValue={analysis.meal_type} className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm">
            {Object.entries(MEAL_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </label>
        <Num name="calories" label="Calorías" value={analysis.calories} />
        <Num name="protein_g" label="Proteínas (g)" value={analysis.protein_g} />
        <Num name="carbs_g" label="Carbohidratos (g)" value={analysis.carbs_g} />
        <Num name="fat_g" label="Grasas (g)" value={analysis.fat_g} />
        <Num name="fiber_g" label="Fibra (g)" value={analysis.fiber_g} />
      </div>
      <label className="block">
        <span className="mb-1 block text-xs text-muted">Porción aproximada</span>
        <input
          name="portion_estimate"
          defaultValue={analysis.portion_estimate}
          className="w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm"
        />
      </label>
    </div>
  );
}

function Num({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-muted">{label}</span>
      <input
        name={name}
        type="number"
        step="0.1"
        defaultValue={value}
        className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm"
      />
    </label>
  );
}
