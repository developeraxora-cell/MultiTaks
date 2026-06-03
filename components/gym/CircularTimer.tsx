"use client";

import { useEffect, useState } from "react";

/**
 * Tiempo de entrenamiento derivado de `startedAt` (timestamp del servidor).
 * Como el valor se calcula de Date.now() - startedAt, el contador es exacto
 * aunque el componente se desmonte al navegar o el usuario recargue: nunca se
 * reinicia ni "se pierde". Solo el tick de 1s es local.
 */
export function useWorkoutTime(startedAt: string | null, estimatedMinutes: number | null) {
  const startMs = startedAt ? Date.parse(startedAt) : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const elapsedSec = startMs != null ? Math.max(0, Math.floor((now - startMs) / 1000)) : 0;
  const targetSec = estimatedMinutes != null && estimatedMinutes > 0 ? estimatedMinutes * 60 : null;
  const over = targetSec != null && elapsedSec > targetSec;
  const overtimeSec = over ? elapsedSec - targetSec! : 0;

  // Progreso 0-1. Antes del límite: fracción del objetivo. Después: fracción del
  // exceso sobre el objetivo (la segunda "vuelta" roja).
  let progress: number;
  if (targetSec == null) progress = 0;
  else if (!over) progress = elapsedSec / targetSec;
  else progress = Math.min(1, (overtimeSec % targetSec) / targetSec);

  return { elapsedSec, targetSec, over, overtimeSec, progress };
}

export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Anillo circular grande para la pantalla de entrenamiento. */
export function CircularTimer({
  startedAt,
  estimatedMinutes,
  size = 120,
  stroke = 9,
}: {
  startedAt: string | null;
  estimatedMinutes: number | null;
  size?: number;
  stroke?: number;
}) {
  const { elapsedSec, targetSec, over, overtimeSec, progress } = useWorkoutTime(
    startedAt,
    estimatedMinutes,
  );

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // Sin objetivo: anillo lleno tenue (solo cuenta hacia arriba).
  const dash = targetSec == null ? circ : circ * (1 - progress);
  const color = over ? "#ef4444" : "var(--accent)";

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
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
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {over ? (
            <>
              <span className="text-lg font-bold text-red-400">+{formatClock(overtimeSec)}</span>
              <span className="text-[10px] text-red-400/80">exceso</span>
            </>
          ) : (
            <>
              <span className="text-xl font-bold tabular-nums">{formatClock(elapsedSec)}</span>
              {targetSec != null && (
                <span className="text-[10px] text-muted">de {formatClock(targetSec)}</span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-sm font-semibold">Cronómetro</p>
        {targetSec != null ? (
          over ? (
            <p className="text-xs text-red-400">
              Superaste los {estimatedMinutes} min estimados.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Objetivo: {estimatedMinutes} min · llevas {formatClock(elapsedSec)}
            </p>
          )
        ) : (
          <p className="text-xs text-muted">Tiempo libre (rutina sin duración estimada)</p>
        )}
        <p className="mt-1 text-[11px] text-muted">Sigue contando aunque cambies de pantalla.</p>
      </div>
    </div>
  );
}
