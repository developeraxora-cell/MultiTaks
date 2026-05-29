"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface RightDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Acciones extra a la izquierda del botón de cerrar (ej. botón "Analizar"). */
  headerActions?: React.ReactNode;
  /** Sobrescribe el estilo del contenedor del cuerpo (por defecto con padding y scroll). */
  bodyClassName?: string;
}

const DURATION = 350; // ms

/** Panel deslizante desde la derecha, con animación de entrada y salida. */
export function RightDrawer({ open, onClose, title, children, headerActions, bodyClassName }: RightDrawerProps) {
  const [render, setRender] = useState(open);
  const [show, setShow] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setRender(true);
      // Doble rAF: deja pintar el estado inicial (fuera de pantalla) antes de animar.
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
    const t = setTimeout(() => setRender(false), DURATION);
    return () => clearTimeout(t);
  }, [open]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!render) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [render, onClose]);

  if (!render) return null;

  return (
    <div className="fixed inset-0 z-50 h-[100dvh]">
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          show ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={`absolute inset-y-0 right-0 flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl transition-transform duration-350 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          show ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="min-w-0 truncate font-semibold">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className={bodyClassName ?? "min-h-0 flex-1 overflow-y-auto p-5"}>{children}</div>
      </aside>
    </div>
  );
}
