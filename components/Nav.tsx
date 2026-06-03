"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  CalendarCheck,
  ListTodo,
  BarChart3,
  Users,
  Activity,
  Salad,
  Dumbbell,
  BookOpen,
  LayoutDashboard,
  History,
  TrendingUp,
  MessageCircle,
  MessageCircleHeart,
  User,
  Menu,
  X,
  Plus,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { createTask } from "@/lib/actions/tasks";
import { signOut } from "@/lib/actions/auth";
import { HABIT_CATEGORIES, type Role } from "@/lib/types";

const BASE_LINKS = [
  { href: "/home", label: "Inicio", icon: Home },
  { href: "/tracker", label: "Seguimiento", icon: CalendarCheck },
  { href: "/tasks", label: "Mis hábitos", icon: ListTodo },
  { href: "/reports", label: "Reportes", icon: BarChart3 },
  { href: "/conversando-ia", label: "Conversando IA", icon: MessageCircleHeart },
  {
    href: "/nutricion",
    label: "Fitness",
    icon: Salad,
    children: [
      { href: "/nutricion/dashboard", label: "Hoy", icon: LayoutDashboard },
      { href: "/nutricion/historial", label: "Historial", icon: History },
      { href: "/nutricion/progreso", label: "Progreso", icon: TrendingUp },
      { href: "/nutricion/chat", label: "Chat IA", icon: MessageCircle },
      { href: "/nutricion/perfil", label: "Perfil", icon: User },
    ],
  },
  {
    href: "/gimnasio",
    label: "Gimnasio",
    icon: Dumbbell,
    children: [
      { href: "/gimnasio/rutinas", label: "Rutinas", icon: Dumbbell },
      { href: "/gimnasio/ejercicios", label: "Ejercicios", icon: BookOpen },
      { href: "/gimnasio/historial", label: "Historial", icon: History },
      { href: "/gimnasio/coach", label: "Coach IA", icon: MessageCircle },
    ],
  },
];

const ADMIN_LINKS = [
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/monitor", label: "Monitoreo", icon: Activity },
];

type LinkItem = {
  href: string;
  label: string;
  icon: typeof CalendarCheck;
  children?: LinkItem[];
};

export function Nav({
  name,
  role,
  fitnessUnlocked,
}: {
  name: string;
  role: Role;
  fitnessUnlocked: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const links: LinkItem[] = useMemo(() => {
    const baseLinks = fitnessUnlocked
      ? BASE_LINKS
      : BASE_LINKS.map((link) =>
          link.href === "/nutricion"
            ? { ...link, href: "/nutricion/onboarding", children: undefined }
            : link,
        );
    return role === "admin" ? [...baseLinks, ...ADMIN_LINKS] : baseLinks;
  }, [fitnessUnlocked, role]);
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

  function NavLink({
    href,
    label,
    icon: Icon,
    onClick,
    nested = false,
  }: LinkItem & { onClick?: () => void; nested?: boolean }) {
    const active = isActive(href);
    return (
      <Link
        href={href}
        onClick={onClick}
        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          active
            ? nested
              ? "text-foreground"
              : "bg-surface-2 text-foreground"
            : nested
              ? "text-muted hover:text-foreground"
              : "text-muted hover:bg-surface-2/60 hover:text-foreground"
        } ${nested ? "w-full rounded-lg py-1.5 pl-4 pr-2 text-[13px]" : ""}`}
      >
        {active && (
          <span
            className={`absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full bg-accent ${
              nested ? "h-3.5 w-0.5" : "h-5 w-1"
            }`}
          />
        )}
        <Icon size={nested ? 14 : 18} className={active ? "text-accent" : ""} />
        {label}
      </Link>
    );
  }

  function NavGroup({ item, onClick }: { item: LinkItem; onClick?: () => void }) {
    const active = isActive(item.href);
    const expanded = expandedGroups[item.href] ?? active;
    const Icon = item.icon;
    const toggle = () => {
      setExpandedGroups((groups) => ({ ...groups, [item.href]: !groups[item.href] }));
    };

    return (
      <div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={expanded}
          className={`group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
            active
              ? "bg-surface-2 text-foreground"
              : "text-muted hover:bg-surface-2/60 hover:text-foreground"
          }`}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
          )}
          <Icon size={18} className={active ? "text-accent" : ""} />
          <span className="flex-1">{item.label}</span>
          <ChevronDown
            size={15}
            className={`transition-transform duration-300 ease-out ${expanded ? "rotate-180" : ""}`}
          />
        </button>
        {item.children && (
          <div
            className={`overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${
              expanded ? "max-h-56 translate-y-0 opacity-100" : "max-h-0 -translate-y-1 opacity-0"
            }`}
          >
            <div className="mt-0.5 w-full rounded-b-xl bg-[#07111f]/75 px-2 py-1.5 shadow-inner shadow-black/10">
              <div className="space-y-0.5 border-l border-accent/20 pl-2">
                {item.children.map((child) => (
                  <NavLink key={child.href} {...child} nested onClick={onClick} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface lg:flex">
        <div className="px-5 py-5">{Brand}</div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {links.map((l) => (
            l.children ? <NavGroup key={l.href} item={l} /> : <NavLink key={l.href} {...l} />
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
              l.children ? (
                <NavGroup key={l.href} item={l} onClick={() => setOpen(false)} />
              ) : (
                <NavLink key={l.href} {...l} onClick={() => setOpen(false)} />
              )
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
                <select
                  name="category"
                  defaultValue="desarrollo_personal"
                  aria-label="Tipo de hábito"
                  className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground"
                >
                  {HABIT_CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
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
