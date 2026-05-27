/**
 * Helpers de presentación del módulo de nutrición. Puros (usables en cliente y
 * servidor). Las etiquetas de enums viven en `./types`.
 */
import type { NutritionQuality } from "./types";

/** Color (clase de texto Tailwind) por calidad nutricional. */
export const QUALITY_COLOR: Record<NutritionQuality, string> = {
  muy_baja: "text-red-400",
  baja: "text-orange-400",
  media: "text-amber-300",
  buena: "text-emerald-300",
  muy_buena: "text-emerald-400",
};

/** Color de fondo (badge) por calidad. */
export const QUALITY_BG: Record<NutritionQuality, string> = {
  muy_baja: "bg-red-500/15 text-red-300",
  baja: "bg-orange-500/15 text-orange-300",
  media: "bg-amber-500/15 text-amber-300",
  buena: "bg-emerald-500/15 text-emerald-300",
  muy_buena: "bg-emerald-500/20 text-emerald-300",
};

/** Porcentaje 0-100 acotado. */
export function pct(value: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((value / total) * 100)));
}

export function round(n: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** "1.420" → con separador de miles es-PE. */
export function fmtNum(n: number): string {
  return new Intl.NumberFormat("es").format(Math.round(n));
}

/** Macros con su color e icono asociado (para tarjetas). */
export const MACRO_META = {
  protein: { label: "Proteínas", color: "#38BDF8", unit: "g" },
  carbs: { label: "Carbohidratos", color: "#FACC15", unit: "g" },
  fat: { label: "Grasas", color: "#F472B6", unit: "g" },
  fiber: { label: "Fibra", color: "#34D399", unit: "g" },
} as const;
