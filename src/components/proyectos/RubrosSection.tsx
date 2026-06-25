interface RubroData {
  id: string
  rubro_type: string
  name: string
  budget_amount: string
  spent: string
  sort_order: number
}

interface Props {
  rubros: RubroData[]
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

function semaphore(pct: number): { bar: string; text: string; label: string } {
  if (pct >= 100) return { bar: "bg-red-500",    text: "text-red-600",    label: "Agotado" }
  if (pct >= 80)  return { bar: "bg-amber-400",  text: "text-amber-600",  label: "Por agotarse" }
  return              { bar: "bg-emerald-500", text: "text-emerald-700", label: "Disponible" }
}

export function RubrosSection({ rubros }: Props) {
  if (rubros.length === 0) {
    return (
      <div className="section-card py-8 text-center">
        <p className="text-sm text-muted-foreground">Sin rubros configurados.</p>
      </div>
    )
  }

  const totalBudget = rubros.reduce((s, r) => s + parseFloat(r.budget_amount), 0)
  const totalSpent  = rubros.reduce((s, r) => s + parseFloat(r.spent), 0)

  return (
    <div className="space-y-3">
      {rubros.map((rubro) => {
        const budget    = parseFloat(rubro.budget_amount)
        const spent     = parseFloat(rubro.spent)
        const available = budget - spent
        const pct       = budget > 0 ? Math.min((spent / budget) * 100, 110) : 0
        const { bar, text, label } = semaphore(pct)

        return (
          <div key={rubro.id} className="rounded-xl border bg-card p-4 space-y-2.5">
            {/* Name + status badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground truncate">{rubro.name}</span>
              {budget > 0 && (
                <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${text}`}>
                  {label}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {budget > 0 ? (
              <>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${bar}`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>

                {/* Amounts row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Presupuesto</p>
                    <p className="text-xs font-semibold tabular-nums text-foreground">
                      {COP.format(budget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Gastado</p>
                    <p className={`text-xs font-semibold tabular-nums ${text}`}>
                      {COP.format(spent)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Disponible</p>
                    <p className={`text-xs font-semibold tabular-nums ${available < 0 ? "text-red-600" : "text-foreground"}`}>
                      {COP.format(available)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground/70">Sin presupuesto asignado</p>
            )}
          </div>
        )
      })}

      {/* Totals row */}
      {totalBudget > 0 && (
        <div className="rounded-xl bg-muted/50 border px-4 py-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground">Total presupuestado</p>
              <p className="text-xs font-bold tabular-nums text-foreground">{COP.format(totalBudget)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Total gastado</p>
              <p className="text-xs font-bold tabular-nums text-foreground">{COP.format(totalSpent)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Total disponible</p>
              <p className={`text-xs font-bold tabular-nums ${totalBudget - totalSpent < 0 ? "text-red-600" : "text-emerald-700"}`}>
                {COP.format(totalBudget - totalSpent)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
