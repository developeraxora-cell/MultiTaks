"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Clock, Search } from "lucide-react";
import { createTask, updateTask, deleteTask } from "@/lib/actions/tasks";
import { HABIT_CATEGORIES, formatTimeRange, habitCategoryLabel, type Task } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { RightDrawer } from "@/components/ui/RightDrawer";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Pagination } from "@/components/ui/Pagination";
import { usePagedList } from "@/lib/use-paged-list";

const field =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function TaskManager({ tasks }: { tasks: Task[] }) {
  const [drawer, setDrawer] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const [, startTransition] = useTransition();

  const act = (fn: () => Promise<void>, msg: string) =>
    startTransition(async () => {
      try {
        await fn();
        toast.success(msg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    });

  const paged = usePagedList(tasks, (t, q) => t.title.toLowerCase().includes(q), 8);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Mis hábitos"
        subtitle={`${tasks.length} activos`}
        action={
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[#0f1623] shadow-lg shadow-accent/20 hover:brightness-105"
          >
            <Plus size={16} /> Nuevo hábito
          </button>
        }
      />

      {/* Buscador (solo si hay varios) */}
      {tasks.length > 6 && (
        <div className="relative mb-3">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={paged.q}
            onChange={(e) => paged.setQuery(e.target.value)}
            placeholder="Buscar hábito…"
            className="w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          />
        </div>
      )}

      {/* Lista */}
      <section className="space-y-2">
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted">
            Aún no tienes hábitos. Crea el primero con “Nuevo hábito”.
          </div>
        )}
        {tasks.length > 0 && paged.total === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            Sin resultados.
          </p>
        )}
        {paged.slice.map((task) =>
          editingId === task.id ? (
            <form
              key={task.id}
              action={async (fd) => {
                try {
                  await updateTask(fd);
                  toast.success("Hábito actualizado");
                  setEditingId(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error");
                }
              }}
              className="grid gap-2 rounded-xl border border-accent bg-surface p-4 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={task.id} />
              <input name="title" required defaultValue={task.title} className={`${field} sm:col-span-2`} />
              <label className="sm:col-span-2">
                <span className="mb-1 block text-xs text-muted">Tipo de hábito</span>
                <select name="category" defaultValue={task.category ?? "desarrollo_personal"} className={field}>
                  {HABIT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                Desde
                <input name="start_time" type="time" defaultValue={task.start_time?.slice(0, 5) ?? ""} className={`${field} flex-1`} />
              </label>
              <label className="flex items-center gap-2 text-xs text-muted">
                Hasta
                <input name="end_time" type="time" defaultValue={task.end_time?.slice(0, 5) ?? ""} className={`${field} flex-1`} />
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-[#0f1623]">
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
                >
                  <X size={14} /> Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border/80"
            >
              <div className="min-w-0 flex-1">
                <span className="block truncate font-medium">{task.title}</span>
                <p className="mt-0.5 text-xs text-muted">{habitCategoryLabel(task.category)}</p>
                {formatTimeRange(task.start_time, task.end_time) && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-accent">
                    <Clock size={12} /> {formatTimeRange(task.start_time, task.end_time)}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconBtn title="Editar" onClick={() => setEditingId(task.id)}>
                  <Pencil size={16} />
                </IconBtn>
                <IconBtn title="Eliminar" onClick={() => setToDelete(task)}>
                  <Trash2 size={16} />
                </IconBtn>
              </div>
            </div>
          ),
        )}
        <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} onPage={paged.setPage} />
      </section>

      {/* Drawer: crear hábito */}
      <RightDrawer open={drawer} onClose={() => setDrawer(false)} title="Nuevo hábito">
        <form
          action={async (fd) => {
            try {
              await createTask(fd);
              toast.success("Hábito creado");
              setDrawer(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="mb-1 block text-xs text-muted">Título</label>
            <input name="title" required placeholder="Ej. Hacer ejercicio" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Tipo de hábito</label>
            <select name="category" defaultValue="desarrollo_personal" className={field}>
              {HABIT_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Desde</label>
              <input name="start_time" type="time" className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Hasta</label>
              <input name="end_time" type="time" className={field} />
            </div>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-[#0f1623] shadow-lg shadow-accent/20 hover:brightness-105"
          >
            Crear hábito
          </button>
        </form>
      </RightDrawer>

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar hábito"
        message={`Se eliminará "${toDelete?.title ?? ""}" y todo su historial. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) act(() => deleteTask(toDelete.id), "Hábito eliminado");
        }}
      />
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="rounded-lg border border-border bg-surface-2 p-2 text-muted transition-colors hover:text-foreground"
    >
      {children}
    </button>
  );
}
