"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
}

/** Controles de paginación: anterior/siguiente + indicador. */
export function Pagination({ page, pageCount, total, onPage }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-sm text-muted">
      <span>{total} en total</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-border bg-surface p-1.5 hover:text-foreground disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-16 text-center">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount}
          className="rounded-lg border border-border bg-surface p-1.5 hover:text-foreground disabled:opacity-40"
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
