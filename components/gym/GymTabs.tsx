"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, BookOpen, History, Sparkles } from "lucide-react";

const TABS = [
  { href: "/gimnasio/rutinas", label: "Rutinas", icon: Dumbbell },
  { href: "/gimnasio/ejercicios", label: "Ejercicios", icon: BookOpen },
  { href: "/gimnasio/historial", label: "Historial", icon: History },
  { href: "/gimnasio/coach", label: "Coach IA", icon: Sparkles },
];

/** Sub-navegación del módulo de gimnasio. Scroll horizontal en móvil. */
export function GymTabs() {
  const pathname = usePathname();
  return (
    <nav className="scroll-thin mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px lg:hidden">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Icon size={16} className={active ? "text-accent" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
