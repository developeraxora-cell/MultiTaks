"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, RotateCcw, Eye, EyeOff, Plus, X } from "lucide-react";
import {
  createTask,
  updateTask,
  setTaskActive,
  softDeleteTask,
  restoreTask,
} from "@/lib/actions/tasks";
import type { Task } from "@/lib/types";

interface TaskManagerProps {
  tasks: Task[];
  deletedTasks: Task[];
}

export function TaskManager({ tasks, deletedTasks }: TaskManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) => startTransition(() => void fn());

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-6">
      {/* Crear (solo desktop; en móvil se crea desde el drawer) */}
      <section className="hidden rounded-xl border border-border bg-surface p-5 sm:block">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Plus size={18} /> Nuevo hábito
        </h2>
        <form
          action={async (fd) => {
            await createTask(fd);
            (document.getElementById("create-form") as HTMLFormElement)?.reset();
          }}
          id="create-form"
          className="grid gap-3 sm:grid-cols-2"
        >
          <input
            name="title"
            required
            placeholder="Título (ej. Hacer ejercicio)"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm sm:col-span-2"
          />
          <input
            name="goal"
            placeholder="Meta (ej. 5 días/semana)"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          />
          <input
            name="description"
            placeholder="Descripción (opcional)"
            className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#0f1623] hover:opacity-90 disabled:opacity-50 sm:col-span-2"
          >
            Crear hábito
          </button>
        </form>
      </section>

      {/* Lista */}
      <section className="space-y-2">
        <h2 className="font-semibold">Mis hábitos ({tasks.length})</h2>
        {tasks.length === 0 && (
          <p className="text-sm text-muted">Aún no tienes hábitos. Crea el primero arriba.</p>
        )}
        {tasks.map((task) =>
          editingId === task.id ? (
            <form
              key={task.id}
              action={async (fd) => {
                await updateTask(fd);
                setEditingId(null);
              }}
              className="grid gap-2 rounded-xl border border-accent bg-surface p-4 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={task.id} />
              <input
                name="title"
                required
                defaultValue={task.title}
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                name="goal"
                defaultValue={task.goal ?? ""}
                placeholder="Meta"
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
              />
              <input
                name="description"
                defaultValue={task.description ?? ""}
                placeholder="Descripción"
                className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
              />
              <div className="flex gap-2 sm:col-span-2">
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-[#0f1623]"
                >
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
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`truncate font-medium ${task.is_active ? "" : "text-muted line-through"}`}>
                    {task.title}
                  </span>
                  {!task.is_active && (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                      inactivo
                    </span>
                  )}
                </div>
                {task.goal && <p className="text-xs text-muted">Meta: {task.goal}</p>}
                {task.description && (
                  <p className="truncate text-xs text-muted">{task.description}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconBtn
                  title={task.is_active ? "Desactivar" : "Activar"}
                  onClick={() => run(() => setTaskActive(task.id, !task.is_active))}
                >
                  {task.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                </IconBtn>
                <IconBtn title="Editar" onClick={() => setEditingId(task.id)}>
                  <Pencil size={16} />
                </IconBtn>
                <IconBtn
                  title="Eliminar (conserva historial)"
                  onClick={() => {
                    if (confirm(`¿Eliminar "${task.title}"? Su historial se conserva para reportes.`)) {
                      run(() => softDeleteTask(task.id));
                    }
                  }}
                >
                  <Trash2 size={16} />
                </IconBtn>
              </div>
            </div>
          ),
        )}
      </section>

      {/* Eliminados */}
      {deletedTasks.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">
            Eliminados ({deletedTasks.length}) · historial conservado
          </h2>
          {deletedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface/50 p-3"
            >
              <span className="flex-1 truncate text-sm text-muted line-through">{task.title}</span>
              <IconBtn title="Restaurar" onClick={() => run(() => restoreTask(task.id))}>
                <RotateCcw size={16} />
              </IconBtn>
            </div>
          ))}
        </section>
      )}
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
      className="rounded-lg border border-border bg-surface-2 p-2 text-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}
