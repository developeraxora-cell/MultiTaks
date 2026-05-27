import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SetupNotice } from "@/components/SetupNotice";
import { ProgressBar } from "@/components/reports/StatCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/server";
import { listUsuariosPaged } from "@/lib/queries/users";
import { reportOverall } from "@/lib/reports/calc";
import { monthRange, parseKey, todayKey, weekRange } from "@/lib/date";

export const dynamic = "force-dynamic";

const PER_PAGE = 8;

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  await requireAdmin();

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);

  // Solo se calcula el cumplimiento de los usuarios de ESTA página.
  const { rows: users, total } = await listUsuariosPaged(page, PER_PAGE);
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const rows = await Promise.all(
    users.map(async (u) => {
      const today = todayKey(u.time_zone);
      const d = parseKey(today);
      const wk = weekRange(today);
      const mo = monthRange(d.getFullYear(), d.getMonth());
      const [day, week, month] = await Promise.all([
        reportOverall(u.id, { start: today, end: today }),
        reportOverall(u.id, wk),
        reportOverall(u.id, mo),
      ]);
      return { user: u, day: day.pct, week: week.pct, month: month.pct };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <PageHeader title="Monitoreo" subtitle={`${total} usuarios · cumplimiento de hábitos`} />

      <div className="space-y-2">
        {rows.map(({ user, day, week, month }) => (
          <Link
            key={user.id}
            href={`/admin/monitor/${user.id}`}
            className="block rounded-xl border border-border bg-surface p-4 hover:border-accent"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">
                {user.full_name}
                {!user.is_active && (
                  <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
                    inactivo
                  </span>
                )}
              </span>
              <span className="text-xs text-muted">{user.email}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <Metric label="Hoy" pct={day} color="#2dd4bf" />
              <Metric label="Semana" pct={week} color="#38bdf8" />
              <Metric label="Mes" pct={month} color="#a855f7" />
            </div>
          </Link>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted">No hay usuarios registrados.</p>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2 text-sm text-muted">
          <span>{total} en total</span>
          <div className="flex items-center gap-2">
            <PagerLink page={page - 1} disabled={page <= 1} aria="Anterior">
              <ChevronLeft size={16} />
            </PagerLink>
            <span className="min-w-16 text-center">
              {page} / {pageCount}
            </span>
            <PagerLink page={page + 1} disabled={page >= pageCount} aria="Siguiente">
              <ChevronRight size={16} />
            </PagerLink>
          </div>
        </div>
      )}
    </div>
  );
}

function PagerLink({
  page,
  disabled,
  aria,
  children,
}: {
  page: number;
  disabled: boolean;
  aria: string;
  children: React.ReactNode;
}) {
  const cls = "rounded-lg border border-border bg-surface p-1.5";
  if (disabled) return <span className={`${cls} opacity-40`}>{children}</span>;
  return (
    <Link href={`/admin/monitor?page=${page}`} aria-label={aria} className={`${cls} hover:text-foreground`}>
      {children}
    </Link>
  );
}

function Metric({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span className="text-muted">{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <ProgressBar pct={pct} color={color} />
    </div>
  );
}
