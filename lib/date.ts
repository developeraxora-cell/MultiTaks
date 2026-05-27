/**
 * Helpers de fecha. Puros (sin dependencias de servidor) → se usan tanto en
 * Server Components como en Client Components para renderizar etiquetas.
 *
 * Convención de "clave de fecha": string `YYYY-MM-DD` en hora LOCAL. Evitamos
 * `new Date("YYYY-MM-DD")` (interpreta UTC y puede correr el día); siempre
 * construimos/parseamos con componentes locales.
 */

export const WEEK_COLORS = [
  "#EC4899", // rosa
  "#A855F7", // violeta
  "#38BDF8", // cian
  "#FACC15", // ámbar
  "#2DD4BF", // teal
] as const;

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const WEEKDAYS_ES = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

const pad = (n: number) => String(n).padStart(2, "0");
const DEFAULT_APP_TIME_ZONE = "America/Mexico_City";

export function appTimeZone(): string {
  return (
    process.env.NEXT_PUBLIC_APP_TIME_ZONE ||
    process.env.APP_TIME_ZONE ||
    DEFAULT_APP_TIME_ZONE
  );
}

export function normalizeTimeZone(timeZone: string | null | undefined): string {
  const value = timeZone?.trim() || appTimeZone();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return appTimeZone();
  }
}

/** Clave `YYYY-MM-DD` desde componentes locales. */
export function dateKey(year: number, monthIndex0: number, day: number): string {
  return `${year}-${pad(monthIndex0 + 1)}-${pad(day)}`;
}

/** Clave `YYYY-MM-DD` para un instante según una zona horaria explícita. */
export function dateKeyInTimeZone(date: Date, timeZone = appTimeZone()): string {
  const safeTimeZone = normalizeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: safeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`No se pudo calcular la fecha para la zona horaria ${safeTimeZone}`);
  }

  return `${year}-${month}-${day}`;
}

/** Clave de hoy en la zona horaria de la app. */
export function todayKey(timeZone = appTimeZone()): string {
  return dateKeyInTimeZone(new Date(), timeZone);
}

/** Parsea `YYYY-MM-DD` a Date local (medianoche local). */
export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Abreviatura de día de semana en español para una clave de fecha. */
export function weekdayShort(key: string): string {
  return WEEKDAYS_ES[parseKey(key).getDay()];
}

export function monthName(monthIndex0: number): string {
  return MONTHS_ES[monthIndex0];
}

export function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

/** Color de "semana" (bloque de 7 días desde el día 1 del mes) para un día. */
export function weekBlockIndex(dayOfMonth: number): number {
  return Math.floor((dayOfMonth - 1) / 7);
}

export function weekColor(blockIndex: number): string {
  return WEEK_COLORS[blockIndex % WEEK_COLORS.length];
}

export interface DayCell {
  key: string;        // YYYY-MM-DD
  day: number;        // día del mes
  weekday: string;    // abreviatura es
  block: number;      // índice de bloque de 7 días (color)
  color: string;
}

/** Todas las celdas-día de un mes, agrupables por `block` para el grid. */
export function monthCells(year: number, monthIndex0: number): DayCell[] {
  const total = daysInMonth(year, monthIndex0);
  const cells: DayCell[] = [];
  for (let day = 1; day <= total; day++) {
    const key = dateKey(year, monthIndex0, day);
    const block = weekBlockIndex(day);
    cells.push({ key, day, weekday: weekdayShort(key), block, color: weekColor(block) });
  }
  return cells;
}

export interface DateRange {
  start: string;
  end: string;
}

/** Semana ISO (lunes a domingo) que contiene la clave dada. */
export function weekRange(key: string): DateRange {
  const d = parseKey(key);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  const start = addDays(key, -dow);
  const end = addDays(start, 6);
  return { start, end };
}

/** 7 celdas-día de la semana que contiene `key`. */
export function weekCells(key: string): DayCell[] {
  const { start } = weekRange(key);
  const cells: DayCell[] = [];
  for (let i = 0; i < 7; i++) {
    const k = addDays(start, i);
    const day = parseKey(k).getDate();
    const block = weekBlockIndex(day);
    cells.push({ key: k, day, weekday: weekdayShort(k), block, color: weekColor(block) });
  }
  return cells;
}

export function monthRange(year: number, monthIndex0: number): DateRange {
  return {
    start: dateKey(year, monthIndex0, 1),
    end: dateKey(year, monthIndex0, daysInMonth(year, monthIndex0)),
  };
}

export function yearRange(year: number): DateRange {
  return { start: dateKey(year, 0, 1), end: dateKey(year, 11, 31) };
}

export interface MonthRef {
  monthIndex: number;
  label: string;
  range: DateRange;
}

/** Los 12 meses de un año con su rango (para la vista anual). */
export function yearMonths(year: number): MonthRef[] {
  return Array.from({ length: 12 }, (_, m) => ({
    monthIndex: m,
    label: monthName(m),
    range: monthRange(year, m),
  }));
}

export function formatRangeLabel(range: DateRange): string {
  const a = parseKey(range.start);
  const b = parseKey(range.end);
  return `${a.getDate()} ${monthName(a.getMonth())} – ${b.getDate()} ${monthName(b.getMonth())}`;
}
