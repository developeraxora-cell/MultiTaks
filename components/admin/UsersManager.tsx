"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus, Pencil, Eye, EyeOff, Plus, AtSign, Search } from "lucide-react";
import { createUser, updateUser, setUserActive } from "@/lib/actions/users";
import type { Usuario } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { RightDrawer } from "@/components/ui/RightDrawer";
import { Pagination } from "@/components/ui/Pagination";
import { usePagedList } from "@/lib/use-paged-list";

const field =
  "w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30";

export function UsersManager({ users }: { users: Usuario[] }) {
  const [drawer, setDrawer] = useState(false);
  const [editUser, setEditUser] = useState<Usuario | null>(null);
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

  const paged = usePagedList(
    users,
    (u, q) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    10,
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Usuarios"
        subtitle={`${users.length} registrados`}
        action={
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[#0f1623] shadow-lg shadow-accent/20 hover:brightness-105"
          >
            <Plus size={16} /> Nuevo usuario
          </button>
        }
      />

      <div className="relative mb-3">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={paged.q}
          onChange={(e) => paged.setQuery(e.target.value)}
          placeholder="Buscar por nombre o usuario…"
          className="w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <section className="space-y-2">
        {paged.total === 0 && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
            Sin resultados.
          </p>
        )}
        {paged.slice.map((u) => (
          <div key={u.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-accent">
              {u.full_name.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={`truncate font-medium ${u.is_active ? "" : "text-muted line-through"}`}>
                  {u.full_name}
                </span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] ${u.role === "admin" ? "bg-accent/20 text-accent" : "bg-surface-2 text-muted"}`}>
                  {u.role}
                </span>
                {!u.is_active && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">inactivo</span>}
              </div>
              <p className="flex items-center gap-1 truncate text-xs text-muted">
                <AtSign size={11} /> {u.email}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <IconBtn title="Editar" onClick={() => setEditUser(u)}>
                <Pencil size={16} />
              </IconBtn>
              <IconBtn
                title={u.is_active ? "Desactivar" : "Activar"}
                onClick={() => act(() => setUserActive(u.id, !u.is_active), u.is_active ? "Usuario desactivado" : "Usuario activado")}
              >
                {u.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
              </IconBtn>
            </div>
          </div>
        ))}
        <Pagination page={paged.page} pageCount={paged.pageCount} total={paged.total} onPage={paged.setPage} />
      </section>

      {/* Drawer: crear usuario */}
      <RightDrawer open={drawer} onClose={() => setDrawer(false)} title="Nuevo usuario">
        <form
          action={async (fd) => {
            try {
              await createUser(fd);
              toast.success("Usuario creado");
              setDrawer(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            }
          }}
          className="space-y-4"
        >
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-muted">
            <UserPlus size={16} /> Datos del usuario
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Nombre completo</label>
            <input name="full_name" required placeholder="Nombre y apellido" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Usuario</label>
            <input name="email" required placeholder="Nombre de usuario" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Contraseña</label>
            <input name="password" type="text" required placeholder="Mínimo 6 caracteres" className={field} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Rol</label>
            <select name="role" defaultValue="user" className={field}>
              <option value="user">Usuario</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-[#0f1623] shadow-lg shadow-accent/20 hover:brightness-105"
          >
            Crear usuario
          </button>
        </form>
      </RightDrawer>

      {/* Drawer: editar usuario */}
      <RightDrawer open={editUser !== null} onClose={() => setEditUser(null)} title="Editar usuario">
        {editUser && (
          <form
            key={editUser.id}
            action={async (fd) => {
              try {
                await updateUser(fd);
                toast.success("Usuario actualizado");
                setEditUser(null);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Error");
              }
            }}
            className="space-y-4"
          >
            <input type="hidden" name="id" value={editUser.id} />
            <div>
              <label className="mb-1 block text-xs text-muted">Nombre completo</label>
              <input name="full_name" required defaultValue={editUser.full_name} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Usuario</label>
              <input name="email" required defaultValue={editUser.email} className={field} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Nueva contraseña</label>
              <input
                name="password"
                type="text"
                placeholder="Dejar vacío para no cambiarla"
                className={field}
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-semibold text-[#0f1623] shadow-lg shadow-accent/20 hover:brightness-105"
            >
              Guardar cambios
            </button>
          </form>
        )}
      </RightDrawer>
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
