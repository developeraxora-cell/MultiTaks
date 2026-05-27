"use client";

import { useRouter, useSearchParams } from "next/navigation";

const PRESETS = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "custom", label: "Rango" },
];

/** Filtros de rango para el historial. Actualizan los searchParams de la URL. */
export function HistoryFilters({ start, end }: { start: string; end: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const active = params.get("range") ?? "semana";

  function setRange(range: string) {
    const p = new URLSearchParams(params.toString());
    p.set("range", range);
    if (range !== "custom") {
      p.delete("start");
      p.delete("end");
    }
    router.push(`/nutricion/historial?${p.toString()}`);
  }

  function setCustom(key: "start" | "end", value: string) {
    const p = new URLSearchParams(params.toString());
    p.set("range", "custom");
    p.set(key, value);
    router.push(`/nutricion/historial?${p.toString()}`);
  }

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((pr) => (
          <button
            key={pr.value}
            type="button"
            onClick={() => setRange(pr.value)}
            className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
              active === pr.value
                ? "bg-emerald-500 text-[#0f1623]"
                : "border border-border text-muted hover:text-foreground"
            }`}
          >
            {pr.label}
          </button>
        ))}
      </div>
      {active === "custom" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <input
            type="date"
            defaultValue={start}
            onChange={(e) => setCustom("start", e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-foreground"
          />
          <span className="text-muted">a</span>
          <input
            type="date"
            defaultValue={end}
            onChange={(e) => setCustom("end", e.target.value)}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-foreground"
          />
        </div>
      )}
    </div>
  );
}
