"use client";

/**
 * Campos de formulario reutilizables para el onboarding y la edición de perfil.
 * Controlados: cada uno recibe value + onChange (string) para vivir en el estado
 * del componente padre.
 */
import { useState, type ReactNode } from "react";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-emerald-400/60";

export function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  type?: string;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={inputCls}
      />
    </Field>
  );
}

export function NumberField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      <input
        type="number"
        inputMode="decimal"
        value={props.value}
        min={props.min}
        max={props.max}
        step={props.step}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={inputCls}
      />
    </Field>
  );
}

export function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  rows?: number;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      <textarea
        value={props.value}
        rows={props.rows ?? 2}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={`${inputCls} resize-y`}
      />
    </Field>
  );
}

export function SelectField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
}) {
  return (
    <Field label={props.label} hint={props.hint}>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={inputCls}
      >
        <option value="">{props.placeholder ?? "Selecciona…"}</option>
        {props.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

// ---------------------------------------------------------------------------
//  Helpers CSV — los campos multi-selección se guardan como "a,b,c".
// ---------------------------------------------------------------------------
import { Plus, X as XIcon, ChevronDown as ChevronDownIcon } from "lucide-react";
import { COUNTRIES, type FoodOption } from "@/lib/nutrition/catalogs";

function csvToArr(csv: string): string[] {
  return csv ? csv.split(",").map((s) => s.trim()).filter(Boolean) : [];
}
function arrToCsv(arr: string[]): string {
  return arr.join(",");
}
function toggle(csv: string, item: string): string {
  const arr = csvToArr(csv);
  return arrToCsv(arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]);
}

/** Tarjetas multi-selección (CSV). Marca varias opciones a la vez. */
export function MultiOptionCards(props: {
  value: string;
  onChange: (csv: string) => void;
  options: { value: string; label: string }[];
  columns?: number;
}) {
  const selected = csvToArr(props.value);
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${props.columns ?? 2}, minmax(0, 1fr))` }}
    >
      {props.options.map((o) => {
        const active = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => props.onChange(toggle(props.value, o.value))}
            className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors ${
              active
                ? "border-emerald-400/70 bg-emerald-500/15 text-foreground"
                : "border-border bg-surface-2 text-muted hover:border-emerald-400/30 hover:text-foreground"
            }`}
          >
            <span>{o.label}</span>
            {active && <span className="text-emerald-300">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Grid de alimentos con emoji (multi-selección, CSV por nombre). Ocupa todo el paso. */
export function FoodPicker(props: {
  value: string;
  onChange: (csv: string) => void;
  options: FoodOption[];
}) {
  const selected = csvToArr(props.value);
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {props.options.map((opt) => {
        const active = selected.includes(opt.name);
        return (
          <button
            key={opt.name}
            type="button"
            onClick={() => props.onChange(toggle(props.value, opt.name))}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
              active
                ? "border-emerald-400/70 bg-emerald-500/20 text-foreground"
                : "border-border bg-surface-2 text-muted hover:border-emerald-400/30 hover:text-foreground"
            }`}
          >
            <span className="text-lg leading-none">{opt.emoji}</span>
            <span className="truncate">{opt.name}</span>
            {active && <span className="ml-auto text-emerald-300">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Sección colapsable de alimentos con emoji (para la edición de perfil). */
export function CollapsibleChips(props: {
  label: string;
  value: string;
  onChange: (csv: string) => void;
  options: FoodOption[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? false);
  const count = csvToArr(props.value).length;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        <span>
          {props.label}
          {count > 0 && (
            <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
              {count}
            </span>
          )}
        </span>
        <ChevronDownIcon size={18} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-border p-4">
          <FoodPicker value={props.value} onChange={props.onChange} options={props.options} />
        </div>
      )}
    </div>
  );
}

/** Select de país con bandera. Guarda el nombre del país. */
export function CountrySelect(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={props.label}>
      <div className="rounded-xl border border-border bg-surface-2 focus-within:border-emerald-400/60">
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className="w-full rounded-xl px-3.5 py-2.5 text-sm text-foreground outline-none"
          style={{ backgroundColor: "var(--surface-2)", color: "var(--foreground)" }}
        >
          <option value="" style={{ backgroundColor: "var(--surface-2)" }}>
            Selecciona tu país…
          </option>
          {COUNTRIES.map((c) => (
            <option key={c.name} value={c.name} style={{ backgroundColor: "var(--surface-2)" }}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </div>
    </Field>
  );
}

/** Lista dinámica de horarios de comida (inputs de hora). Guarda CSV "08:00,13:00". */
export function MealTimesField(props: {
  label: string;
  value: string;
  onChange: (csv: string) => void;
  hint?: string;
}) {
  const times = csvToArr(props.value);
  const list = times.length > 0 ? times : [""];

  function update(i: number, v: string) {
    const next = [...list];
    next[i] = v;
    props.onChange(arrToCsv(next.filter(Boolean)));
  }
  function add() {
    props.onChange(arrToCsv([...times, "12:00"]));
  }
  function remove(i: number) {
    props.onChange(arrToCsv(list.filter((_, idx) => idx !== i).filter(Boolean)));
  }

  return (
    <Field label={props.label} hint={props.hint}>
      <div className="space-y-2">
        {list.map((t, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="time"
              value={t}
              onChange={(e) => update(i, e.target.value)}
              className="flex-1 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-foreground outline-none focus:border-emerald-400/60"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted hover:text-red-400"
              aria-label="Quitar horario"
            >
              <XIcon size={15} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted hover:border-emerald-400/40 hover:text-foreground"
        >
          <Plus size={15} /> Agregar horario
        </button>
      </div>
    </Field>
  );
}

/** Selección tipo tarjeta (radio visual) para una sola opción. */
export function OptionCards(props: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  columns?: number;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${props.columns ?? 2}, minmax(0, 1fr))` }}
    >
      {props.options.map((o) => {
        const active = props.value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => props.onChange(o.value)}
            className={`rounded-xl border px-3.5 py-3 text-left text-sm transition-colors ${
              active
                ? "border-emerald-400/70 bg-emerald-500/15 text-foreground"
                : "border-border bg-surface-2 text-muted hover:border-emerald-400/30 hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
