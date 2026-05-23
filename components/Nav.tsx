"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  CalendarCheck,
  ListTodo,
  BarChart3,
  Users,
  Activity,
  Menu,
  X,
  Plus,
  LogOut,
} from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import { signOut } from "@/lib/actions/auth";
import type { Role } from "@/lib/types";

const BASE_LINKS = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/tracker", label: "Seguimiento", icon: CalendarCheck },
  { href: "/tasks", label: "Mis hábitos", icon: ListTodo },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
];

const ADMIN_LINKS = [
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/monitor", label: "Monitoreo", icon: Activity },
];

type LinkItem = { href: string; label: string; icon: typeof CalendarCheck };

export function Nav({ name, role }: { name: string; role: Role }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const links: LinkItem[] = role === "admin" ? [...BASE_LINKS, ...ADMIN_LINKS] : BASE_LINKS;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Montaje + animación del drawer.
  const [render, setRender] = useState(false);
  const [show, setShow] = useState(false);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setRender(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setShow(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setShow(false);
    const t = setTimeout(() => setRender(false), 300);
    return () => clearTimeout(t);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    document.body.style.overflow = render ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [render]);

  const Brand = (
    <div className="flex items-center gap-2.5 font-semibold">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent">●</span>
      <span>Mentes Creadoras</span>
    </div>
  );

  function NavLink({ href, label, icon: Icon, onClick }: LinkItem & { onClick?: () => void }) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          active
            ? "bg-surface-2 text-foreground"
            : "text-muted hover:bg-surface-2/60 hover:text-foreground"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
        )}
        <Icon size={18} className={active ? "text-accent" : ""} />
        {label}
      </Link>
    );
  }

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-5 py-5">{Brand}</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs capitalize text-muted">{role === "admin" ? "Administrador" : "Usuario"}</p>
          </div>
          <form action={signOut}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <LogOut size={18} /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>

      {/* Topbar (móvil/tablet) */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-surface px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>
        <Link href="/home">{Brand}</Link>
        <form action={signOut} className="ml-auto">
          <button
            type="submit"
            className="flex items-center gap-1 rounded-lg border border-border px-2 py-1.5 text-sm text-muted hover:text-foreground"
            aria-label="Cerrar sesión"
          >
            <LogOut size={16} />
          </button>
        </form>
      </header>

      {/* Drawer (móvil/tablet) */}
      {render && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ease-out ${
              show ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside
            className={`absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col gap-1 border-r border-border bg-surface p-4 shadow-xl transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
              show ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <div className="mb-3 flex items-center justify-between">
              {Brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>
            </div>
            <p className="mb-1 px-2 text-xs text-muted">
              {name} · {role === "admin" ? "Administrador" : "Usuario"}
            </p>

            {links.map((l) => (
              <NavLink key={l.href} {...l} onClick={() => setOpen(false)} />
            ))}

            <div className="mt-4 border-t border-border pt-4">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
                <Plus size={14} /> Nuevo hábito
              </p>
              <form
                action={async (fd) => {
                  await createTask(fd);
                  setOpen(false);
                  router.refresh();
                }}
                className="space-y-2"
              >
                <input
                  name="title"
                  required
                  placeholder="Título"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <input name="start_time" type="time" aria-label="Hora desde" className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-foreground" />
                  <input name="end_time" type="time" aria-label="Hora hasta" className="w-full rounded-lg border border-border bg-surface-2 px-2 py-2 text-sm text-foreground" />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#0f1623] hover:opacity-90"
                >
                  Crear
                </button>
              </form>
            </div>

            <form action={signOut} className="mt-auto pt-4">
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm text-muted hover:text-foreground"
              >
                <LogOut size={16} /> Cerrar sesión
              </button>
            </form>
          </aside>
        </div>
      )}
    </>
  );
}
