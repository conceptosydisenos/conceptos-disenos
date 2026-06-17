import { calculateAmortization, calculateNetToPay } from "@/lib/calculations"

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
})

interface CorteSummaryProps {
  totalExecuted: number
  advancePercentage: number
  quotedAmount?: number
  cumulativeProgress?: number
  baseExecuted?: number
  extrasTotal?: number
}

export function CorteSummary({
  totalExecuted,
  advancePercentage,
  quotedAmount,
  cumulativeProgress,
  baseExecuted,
  extrasTotal = 0,
}: CorteSummaryProps) {
  const amortization = calculateAmortization(totalExecuted, advancePercentage)
  const amountToPay = calculateNetToPay(totalExecuted, amortization)
  const showBreakdown = extrasTotal > 0 && baseExecuted !== undefined

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 bg-muted/40 border-b">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Resumen del corte
        </p>
      </div>
      <div className="divide-y divide-border">
        {showBreakdown && (
          <>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-xs text-muted-foreground">Actividades base</span>
              <span className="text-xs tabular-nums">{COP.format(baseExecuted!)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-xs text-muted-foreground">Adicionales aprobados</span>
              <span className="text-xs tabular-nums text-green-600">+ {COP.format(extrasTotal)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-muted-foreground">Valor ejecutado total</span>
          <span className="text-sm font-bold tabular-nums">{COP.format(totalExecuted)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-muted-foreground">
            Amortización anticipo ({advancePercentage}%)
          </span>
          <span className="text-sm tabular-nums text-destructive">− {COP.format(amortization)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3 bg-primary/5">
          <span className="text-sm font-semibold">Saldo a pagar al cliente</span>
          <span className="text-base font-bold tabular-nums">{COP.format(amountToPay)}</span>
        </div>
        {quotedAmount !== undefined && cumulativeProgress !== undefined && (
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Avance acumulado del proyecto</span>
              <span className="font-medium">{cumulativeProgress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${Math.min(100, cumulativeProgress)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
