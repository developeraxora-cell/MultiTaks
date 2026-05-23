"use client";

import { useMemo, useState } from "react";

/** Búsqueda + paginación en cliente sobre una lista ya cargada. */
export function usePagedList<T>(
  items: T[],
  matches: (item: T, query: string) => boolean,
  perPage = 10,
) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? items.filter((it) => matches(it, term)) : items;
    // matches es estable por uso (definida inline pero pura); intencional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const current = Math.min(page, pageCount);
  const slice = filtered.slice((current - 1) * perPage, current * perPage);

  return {
    q,
    setQuery: (v: string) => {
      setQ(v);
      setPage(1);
    },
    page: current,
    pageCount,
    total: filtered.length,
    slice,
    setPage,
  };
}
