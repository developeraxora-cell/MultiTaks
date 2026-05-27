import { fmtNum, pct } from "@/lib/nutrition/format";

/** Anillo de progreso calórico (SVG, sin dependencias). */
export function DailyCaloriesCard({
  goal,
  consumed,
}: {
  goal: number;
  consumed: number;
}) {
  const percentage = pct(consumed, goal);
  const remaining = Math.max(0, goal - consumed);
  const over = consumed > goal;

  const size = 168;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(100, percentage) / 100) * circ;

  return (
    <div className="rounded-3xl border border-border bg-surface p-6">
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={over ? "#f87171" : "#34d399"}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold tracking-tight">{fmtNum(consumed)}</span>
            <span className="text-xs text-muted">de {fmtNum(goal)} kcal</span>
            <span className={`mt-0.5 text-xs font-medium ${over ? "text-red-400" : "text-emerald-300"}`}>
              {percentage}%
            </span>
          </div>
        </div>
        <p className="mt-4 text-center text-sm">
          {over ? (
            <span className="text-red-400">
              Excedido en {fmtNum(consumed - goal)} kcal
            </span>
          ) : (
            <span className="text-muted">
              Restante: <span className="font-semibold text-foreground">{fmtNum(remaining)} kcal</span>
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

interface Macro {
  label: string;
  color: string;
  value: number;
  goal: number;
  unit: string;
}

/** Tarjeta con barras de progreso de macronutrientes. */
export function MacroProgressCard({ macros }: { macros: Macro[] }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-5">
      <h3 className="mb-4 text-sm font-semibold">Macronutrientes</h3>
      <div className="space-y-3.5">
        {macros.map((m) => {
          const p = pct(m.value, m.goal);
          return (
            <div key={m.label}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-muted">{m.label}</span>
                <span>
                  <span className="font-medium">{fmtNum(m.value)}</span>
                  <span className="text-muted"> / {fmtNum(m.goal)} {m.unit}</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${p}%`, backgroundColor: m.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Tarjeta compacta de una métrica simple. */
export function StatTile({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
