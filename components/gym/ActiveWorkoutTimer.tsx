"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell } from "lucide-react";

import { useWorkoutTime, formatClock } from "./CircularTimer";

/**
 * Pill flotante visible en TODA la app mientras hay un entrenamiento en curso.
 * El tiempo se deriva de `startedAt`, así sigue contando aunque el usuario esté
 * en otro módulo. Se oculta en la propia pantalla de entrenar (ya tiene su
 * cronómetro grande).
 */
export function ActiveWorkoutTimer({
  sessionId,
  startedAt,
  estimatedMinutes,
  routineName,
}: {
  sessionId: string;
  startedAt: string | null;
  estimatedMinutes: number | null;
  routineName: string | null;
}) {
  const pathname = usePathname();
  const { elapsedSec, targetSec, over, overtimeSec, progress } = useWorkoutTime(
    startedAt,
    estimatedMinutes,
  );

  // En la pantalla de entrenamiento no mostramos el pill (hay timer grande).
  if (pathname?.startsWith(`/gimnasio/entrenar/${sessionId}`)) return null;

  const size = 34;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = targetSec == null ? 0 : circ * (1 - progress);
  const color = over ? "#ef4444" : "var(--accent)";

  return (
    <Link
      href={`/gimnasio/entrenar/${sessionId}`}
      className={`fixed bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-full border bg-surface/95 py-2 pl-2 pr-4 shadow-lg backdrop-blur transition-colors hover:border-accent/50 ${
        over ? "border-red-500/50" : "border-border"
      }`}
    >
      <span className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          {targetSec != null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dash}
              style={{ transition: "stroke-dashoffset 1s linear, stroke 0.4s" }}
            />
          )}
        </svg>
        <Dumbbell size={13} className={`absolute ${over ? "text-red-400" : "text-accent"}`} />
      </span>
      <span className="leading-tight">
        <span className={`block text-sm font-bold tabular-nums ${over ? "text-red-400" : ""}`}>
          {over ? `+${formatClock(overtimeSec)}` : formatClock(elapsedSec)}
        </span>
        <span className="block max-w-[140px] truncate text-[11px] text-muted">
          {over ? "tiempo excedido" : routineName ?? "Entrenamiento"}
        </span>
      </span>
    </Link>
  );
}
