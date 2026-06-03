"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Play } from "lucide-react";

import { startWorkoutFromRoutine } from "@/lib/actions/gym";

export function StartRoutineButton({
  routineId,
  className,
}: {
  routineId: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await startWorkoutFromRoutine(routineId);
          } catch (e) {
            if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
            const digest = (e as { digest?: string })?.digest;
            if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return;
            toast.error(e instanceof Error ? e.message : "No se pudo iniciar");
          }
        })
      }
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-[#0f1623] hover:brightness-105 disabled:opacity-50"
      }
    >
      <Play size={16} /> {pending ? "Iniciando…" : "Iniciar entrenamiento"}
    </button>
  );
}
