"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type ViewMode = "daily" | "weekly" | "monthly" | "annual";

const VIEWS: { mode: ViewMode; label: string }[] = [
  { mode: "daily", label: "Día" },
  { mode: "weekly", label: "Semana" },
  { mode: "monthly", label: "Mes" },
  { mode: "annual", label: "Año" },
];

interface ViewSwitcherProps {
  view: ViewMode;
  /** Clave de fecha de referencia (ancla del periodo mostrado). */
  date: string;
  /** Etiqueta del periodo actual (ej. "mayo 2026"). */
  periodLabel: string;
  /** Claves de fecha para navegar al periodo anterior / siguiente. */
  prevDate: string;
  nextDate: string;
}

export function ViewSwitcher({
  view,
  date,
  periodLabel,
  prevDate,
  nextDate,
}: ViewSwitcherProps) {
  const router = useRouter();

  const go = (v: ViewMode, d: string) =>
    router.push(`/tracker?view=${v}&date=${d}`);

  return (
    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <button
          type="button"
          onClick={() => go(view, prevDate)}
          className="rounded-lg border border-border bg-surface p-1.5 text-muted hover:text-foreground"
          aria-label="Periodo anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="flex-1 text-center text-sm font-medium capitalize sm:min-w-40 sm:flex-none">
          {periodLabel}
        </span>
        <button
          type="button"
          onClick={() => go(view, nextDate)}
          className="rounded-lg border border-border bg-surface p-1.5 text-muted hover:text-foreground"
          aria-label="Periodo siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-0.5 rounded-lg border border-border bg-surface p-0.5 sm:flex">
        {VIEWS.map((v) => (
          <button
            key={v.mode}
            type="button"
            onClick={() => go(v.mode, date)}
            className={`rounded-md px-3 py-1.5 text-center text-sm transition-colors ${
              view === v.mode
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
