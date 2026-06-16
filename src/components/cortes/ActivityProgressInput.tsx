"use client"

import { Minus, Plus } from "lucide-react"

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

interface ActivityProgressInputProps {
  id: string
  name: string
  unit: string
  category: string
  totalPrice: number
  previousPct: number // cumulative % from approved cuts
  currentPct: number // this cut's increment
  onChange: (id: string, pct: number) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  materiales: "Materiales",
  mano_obra: "Mano de obra",
  equipos: "Equipos",
  imprevistos: "Imprevistos",
  otro: "Otro",
}

export function ActivityProgressInput({
  id,
  name,
  unit,
  category,
  totalPrice,
  previousPct,
  currentPct,
  onChange,
}: ActivityProgressInputProps) {
  const maxAllowed = Math.max(0, 100 - previousPct)
  const executedAmount = (totalPrice * currentPct) / 100
  const cumulativePct = Math.min(100, previousPct + currentPct)

  const increment = (delta: number) => {
    const next = Math.max(0, Math.min(maxAllowed, currentPct + delta))
    onChange(id, next)
  }

  const handleInput = (raw: string) => {
    const val = parseFloat(raw) || 0
    onChange(id, Math.max(0, Math.min(maxAllowed, val)))
  }

  const isComplete = cumulativePct >= 100
  const hasProgress = currentPct > 0

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-colors ${hasProgress ? "border-primary/40 bg-primary/5" : "bg-card"}`}>
      {/* Activity header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {CATEGORY_LABELS[category] ?? category} · {unit}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Cotizado</p>
          <p className="text-sm font-bold tabular-nums">{COP.format(totalPrice)}</p>
        </div>
      </div>

      {/* Previous progress bar */}
      {previousPct > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Avance anterior</span>
            <span>{previousPct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-muted-foreground/40 rounded-full"
              style={{ width: `${previousPct}%` }}
            />
          </div>
        </div>
      )}

      {/* This cut's input */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Este corte {maxAllowed === 0 ? "— actividad completada" : `(máx. ${maxAllowed.toFixed(0)}%)`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => increment(-5)}
            disabled={currentPct <= 0 || maxAllowed === 0}
            className="h-10 w-10 rounded-lg border flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted active:scale-95 transition-all shrink-0"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="relative flex-1">
            <input
              type="number"
              min={0}
              max={maxAllowed}
              step={1}
              value={currentPct === 0 ? "" : currentPct}
              placeholder="0"
              disabled={maxAllowed === 0}
              onChange={(e) => handleInput(e.target.value)}
              className="w-full h-10 rounded-lg border px-3 pr-8 text-center tabular-nums text-base font-bold focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed bg-background"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
              %
            </span>
          </div>

          <button
            type="button"
            onClick={() => increment(5)}
            disabled={currentPct >= maxAllowed || maxAllowed === 0}
            className="h-10 w-10 rounded-lg border flex items-center justify-center text-foreground disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Execution result */}
        {hasProgress && (
          <div className="flex items-center justify-between text-sm pt-1">
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.round(cumulativePct * 0.6)}px`, minWidth: "4px" }}
              />
              <span className="text-xs text-muted-foreground">
                Acumulado: {cumulativePct.toFixed(1)}%
                {isComplete && " ✓"}
              </span>
            </div>
            <span className="font-bold tabular-nums text-primary">
              {COP.format(executedAmount)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
