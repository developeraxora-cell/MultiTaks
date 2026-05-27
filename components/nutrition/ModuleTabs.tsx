"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, TrendingUp, MessageCircle, Settings } from "lucide-react";

const TABS = [
  { href: "/nutricion/dashboard", label: "Hoy", icon: LayoutDashboard },
  { href: "/nutricion/historial", label: "Historial", icon: History },
  { href: "/nutricion/progreso", label: "Progreso", icon: TrendingUp },
  { href: "/nutricion/chat", label: "Chat IA", icon: MessageCircle },
  { href: "/nutricion/perfil", label: "Perfil", icon: Settings },
];

/** Sub-navegación del módulo. Scroll horizontal en móvil. */
export function ModuleTabs() {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
              active
                ? "border-emerald-400 text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Icon size={16} className={active ? "text-emerald-300" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
