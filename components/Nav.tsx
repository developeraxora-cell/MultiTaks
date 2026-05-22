"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarCheck,
  ListTodo,
  BarChart3,
  Menu,
  X,
  Plus,
} from "lucide-react";
import { createTask } from "@/lib/actions/tasks";

const LINKS = [
  { href: "/tracker", label: "Seguimiento", icon: CalendarCheck },
  { href: "/tasks", label: "Mis hábitos", icon: ListTodo },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  // Bloquea el scroll del body mientras el drawer está abierto.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center gap-1 px-4 py-3">
        {/* Hamburguesa (solo móvil) */}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mr-1 rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground sm:hidden"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        <Link href="/tracker" className="mr-4 flex items-center gap-2 font-semibold">
          <span className="text-accent">●</span>
          <span>Hábitos</span>
        </Link>

        {/* Links inline (desktop) */}
        <div className="hidden items-center gap-1 sm:flex">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                isActive(href)
                  ? "bg-surface-2 text-foreground"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>
      </nav>
      </header>

      {/* Drawer móvil (fuera del header para que `fixed` cubra el viewport) */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 max-w-[80%] flex-col gap-1 border-r border-border bg-surface p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold">
                <span className="text-accent">●</span> Hábitos
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                aria-label="Cerrar menú"
              >
                <X size={20} />
              </button>
            </div>

            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive(href)
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            ))}

            {/* Crear hábito rápido */}
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
                <input
                  name="goal"
                  placeholder="Meta (opcional)"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#0f1623] hover:opacity-90"
                >
                  Crear
                </button>
              </form>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
