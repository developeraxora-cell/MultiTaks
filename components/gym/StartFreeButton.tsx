"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";

import { startFreeWorkout } from "@/lib/actions/gym";

/** Inicia un entrenamiento libre (sin rutina) y redirige a la pantalla de entrenar. */
export function StartFreeButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await startFreeWorkout();
          } catch (e) {
            if (e instanceof Error && e.message === "NEXT_REDIRECT") return;
            const digest = (e as { digest?: string })?.digest;
            if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) return;
            toast.error(e instanceof Error ? e.message : "No se pudo iniciar");
          }
        })
      }
      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted hover:text-foreground disabled:opacity-50"
    >
      <Zap size={16} /> Libre
    </button>
  );
}
