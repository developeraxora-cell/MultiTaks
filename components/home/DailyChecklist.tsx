"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Clock, PartyPopper } from "lucide-react";
import { toggleTodayLog } from "@/lib/actions/logs";
import { DEFAULT_HABIT_CATEGORY, HABIT_CATEGORIES, formatTimeRange, type HabitCategory } from "@/lib/types";
import { StatCard } from "@/components/reports/StatCard";
import { HabitCategoryRadar } from "@/components/reports/HabitCategoryRadar";

interface Item {
  id: string;
  title: string;
  category: HabitCategory | null;
  start_time: string | null;
  end_time: string | null;
}

export function DailyChecklist({
  tasks,
  initialDone,
  weekPct,
  monthPct,
}: {
  tasks: Item[];
  initialDone: string[];
  weekPct: number;
  monthPct: number;
}) {
  const [done, setDone] = useState<Set<string>>(new Set(initialDone));
  const [vanishing, setVanishing] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const total = tasks.length;
  const completed = done.size;
  const pct = total ? Math.round((100 * completed) / total) : 0;

  function persist(id: string, next: boolean) {
    startTransition(async () => {
      try {
        await toggleTodayLog(id, next);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "No se pudo guardar");
        setDone((d) => {
          const n = new Set(d);
          if (next) n.delete(id);
          else n.add(id);
          return n;
        });
      }
    });
  }

  function complete(it: Item) {
    // Anima el desvanecido y luego mueve a "completadas".
    setVanishing((v) => new Set(v).add(it.id));
    setTimeout(() => {
      setDone((d) => new Set(d).add(it.id));
      setVanishing((v) => {
        const n = new Set(v);
        n.delete(it.id);
        return n;
      });
    }, 350);
    toast.success("¡Cumplido!", { duration: 1200 });
    persist(it.id, true);
  }

  function undo(it: Item) {
    setDone((d) => {
      const n = new Set(d);
      n.delete(it.id);
      return n;
    });
    persist(it.id, false);
  }

  const pending = tasks.filter((t) => !done.has(t.id));
  const completedList = tasks.filter((t) => done.has(t.id));
  const categoryData = HABIT_CATEGORIES.map((category) => {
    const categoryTasks = tasks.filter((task) => (task.category ?? DEFAULT_HABIT_CATEGORY) === category.value);
    const categoryDone = categoryTasks.filter((task) => done.has(task.id)).length;
    return {
      label: category.label,
      completed: categoryDone,
      possible: categoryTasks.length,
      pct: categoryTasks.length > 0 ? Math.round((100 * categoryDone) / categoryTasks.length) : 0,
    };
  });

  return (
    <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
      {/* Columna izquierda: progreso + resumen */}
      <div className="mb-6 space-y-3 lg:mb-0 lg:sticky lg:top-20">
      <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface p-5 lg:flex-col lg:items-start lg:text-left">
        <ProgressRing pct={pct} />
        <div className="min-w-0">
          <p className="text-sm text-muted">Progreso de hoy</p>
          <p className="text-lg font-semibold">
            {completed} <span className="text-muted">de</span> {total} cumplidos
          </p>
          <p className="mt-0.5 text-xs text-accent">
            {total === 0
              ? "Sin hábitos para hoy"
              : pct === 100
                ? "¡Día completo! 🎉"
                : pct === 0
                  ? "¡Empieza tu día!"
                  : "¡Vas muy bien, sigue así!"}
          </p>
        </div>
      </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Semana" value={`${weekPct}%`} accent="#38bdf8" />
          <StatCard label="Mes" value={`${monthPct}%`} accent="#a855f7" />
        </div>
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-muted">Balance de hoy</h2>
          <HabitCategoryRadar data={categoryData} height={260} />
        </section>
      </div>

      <div className="space-y-6 lg:col-span-2">
      {/* Pendientes */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Por hacer ({pending.length})</h2>
        {pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted">
            <PartyPopper className="text-accent" size={28} />
            ¡Todo cumplido por hoy!
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
          {pending.map((it) => {
            const isVanishing = vanishing.has(it.id);
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => !isVanishing && complete(it)}
                className={`group flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-lg hover:shadow-accent/10 ${
                  isVanishing ? "scale-95 opacity-0" : "opacity-100"
                }`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-muted text-transparent transition-colors group-hover:border-accent group-hover:bg-accent group-hover:text-[#0f1623]">
                  <Check size={16} strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{it.title}</span>
                  {formatTimeRange(it.start_time, it.end_time) && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                      <Clock size={12} /> {formatTimeRange(it.start_time, it.end_time)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
          </div>
        )}
      </section>

      {/* Completadas */}
      {completedList.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Cumplidas ({completedList.length})</h2>
          <div className="grid gap-2 sm:grid-cols-2">
          {completedList.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => undo(it)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface/40 p-4 text-left transition-colors"
              title="Deshacer"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-[#0f1623]">
                <Check size={16} strokeWidth={3} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-muted line-through">
                {it.title}
              </span>
            </button>
          ))}
          </div>
        </section>
      )}
      </div>
    </div>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.32,0.72,0,1)" }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-lg font-bold">{pct}%</span>
    </div>
  );
}
