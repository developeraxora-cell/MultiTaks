"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { toggleLog } from "@/lib/actions/logs";

interface HabitCellProps {
  taskId: string;
  date: string;
  color: string;
  completed: boolean;
}

/**
 * Checkbox de una celda (tarea × día). Optimista: cambia al instante y revierte
 * si el Server Action falla. El borde/relleno usa el color de la semana.
 */
export function HabitCell({ taskId, date, color, completed }: HabitCellProps) {
  const [checked, setChecked] = useState(completed);
  const [pending, startTransition] = useTransition();

  function onClick() {
    const next = !checked;
    setChecked(next); // optimista
    startTransition(async () => {
      try {
        await toggleLog(taskId, date, next);
      } catch {
        setChecked(!next); // revertir
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={checked}
      aria-label={`${date}${checked ? " completado" : ""}`}
      title={date}
      className={`flex h-8 w-8 items-center justify-center rounded-md border-2 transition-colors sm:h-7 sm:w-7 ${
        pending ? "opacity-70" : ""
      }`}
      style={{
        borderColor: color,
        backgroundColor: checked ? color : "transparent",
      }}
    >
      {checked && <Check size={16} strokeWidth={3} className="text-[#0f1623]" />}
    </button>
  );
}
