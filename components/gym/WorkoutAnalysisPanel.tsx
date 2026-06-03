"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, CheckCircle2, AlertTriangle, Target, RefreshCw } from "lucide-react";

import type { GymWorkoutAnalysisRow } from "@/lib/gym/types";
import { generateWorkoutAnalysis } from "@/lib/actions/gym";

export function WorkoutAnalysisPanel({
  sessionId,
  analysis,
}: {
  sessionId: string;
  analysis: GymWorkoutAnalysisRow | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      try {
        await generateWorkoutAnalysis(sessionId);
        toast.success("Análisis generado");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo generar");
      }
    });
  }

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface/40 p-6 text-center">
        <Sparkles size={24} className="mx-auto mb-2 text-accent" />
        <p className="mb-1 text-sm font-medium">Análisis con IA</p>
        <p className="mb-4 text-sm text-muted">
          Compara tu objetivo con lo realizado y recibe recomendaciones.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50"
        >
          <Sparkles size={16} /> {pending ? "Analizando…" : "Analizar con IA"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-surface p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold">
          <Sparkles size={18} className="text-accent" /> Análisis con IA
          {analysis.is_mock && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-normal text-muted">
              demo
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw size={13} className={pending ? "animate-spin" : ""} /> Regenerar
        </button>
      </div>

      {analysis.summary && <p className="mb-4 text-sm text-muted">{analysis.summary}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {analysis.what_went_well && analysis.what_went_well.length > 0 && (
          <Block
            icon={<CheckCircle2 size={15} className="text-accent" />}
            title="Lo que salió bien"
            items={analysis.what_went_well}
          />
        )}
        {analysis.to_improve && analysis.to_improve.length > 0 && (
          <Block
            icon={<AlertTriangle size={15} className="text-amber-300" />}
            title="A mejorar"
            items={analysis.to_improve}
          />
        )}
      </div>

      {analysis.next_focus && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-accent/10 p-3">
          <Target size={16} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="text-xs font-semibold text-accent">Foco próxima sesión</p>
            <p className="text-sm text-foreground">{analysis.next_focus}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Block({
  icon,
  title,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        {icon} {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-muted">
            • {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
